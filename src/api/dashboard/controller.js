const database = require('#database');

const admin = async (req, res, next) => {
  try {
    const user = await database.user.count();
    const pembelian = await database.pembelian.count();
    const soal = await database.bankSoal.count();
    const voucher = await database.voucher.count();
    const event = await database.event.count();

    const get5User = await database.user.findMany({
      skip: 0,
      take: 5,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const get5Pembelian = await database.pembelian.findMany({
      skip: 0,
      take: 5,
      include: {
        paketPembelian: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        user,
        pembelian,
        soal,
        voucher,
        event,
        users: get5User,
        pembelians: get5Pembelian,
      },
    });
  } catch (error) {
    next(error);
  }
};
const rekapPenjualan = async (req, res, next) => {
  try {
    const {
      startDate = "",
      endDate = "",
      search = "",
      sort = "",
      sortBy = "",
      descending = true,
      skip = 0,
      take = 10,
    } = req.query;

    // ----------------------------
    // 1. Build date filter
    // ----------------------------
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.paidAt = {};
      if (startDate) dateFilter.paidAt.gte = new Date(`${startDate}T00:00:00`);
      if (endDate) dateFilter.paidAt.lte = new Date(`${endDate}T23:59:59`);
    }

    const wherePembelian = {
      status: "PAID",
      ...(Object.keys(dateFilter).length > 0 && dateFilter),
    };

    // ----------------------------
    // 2. Ambil daftar paket DISTINCT
    // ----------------------------
    const distinctPaket = await database.pembelian.findMany({
      where: wherePembelian,
      distinct: ["paketPembelianId"],
      select: {
        paketPembelianId: true,
        paketPembelian: {
          select: {
            id: true,
            nama: true,
            harga: true,
            createdAt: true, // diperlukan FE
          },
        },
      },
    });

    // ----------------------------
    // 3. Hitung total pembelian per paket
    // ----------------------------
    const rekap = await Promise.all(
      distinctPaket.map(async (item) => {
        const jumlahTerjual = await database.pembelian.count({
          where: {
            paketPembelianId: item.paketPembelianId,
            status: "PAID",
            ...(Object.keys(dateFilter).length > 0 && dateFilter),
          },
        });

        return {
          id: item.paketPembelian?.id || 0,
          namaPaket: item.paketPembelian?.nama || "(Paket dihapus)",
          jumlahTerjual,
          createdAt: item.paketPembelian?.createdAt || null,
        };
      })
    );

    // ----------------------------
    // 4. Search filter
    // ----------------------------
    let filtered = rekap;
    if (search) {
      const lower = search.toLowerCase();
      filtered = filtered.filter((item) =>
        item.namaPaket.toLowerCase().includes(lower)
      );
    }

    // ----------------------------
    // 5. Flexible Sorting System
    // ----------------------------

    const dir = descending === "false" || descending === false ? 1 : -1;

    filtered.sort((a, b) => {
      // A. Sorting by terjual_asc / terjual_desc
      if (sort === "terjual_asc") {
        return a.jumlahTerjual - b.jumlahTerjual;
      }
      if (sort === "terjual_desc") {
        return b.jumlahTerjual - a.jumlahTerjual;
      }

      // B. Sorting by field (sortBy)
      if (sortBy) {
        const A = a[sortBy];
        const B = b[sortBy];

        // jika date
        if (A instanceof Date && B instanceof Date) return dir * (A - B);

        // jika string
        if (typeof A === "string" && typeof B === "string")
          return dir * A.localeCompare(B);

        // jika number
        if (typeof A === "number" && typeof B === "number")
          return dir * (A - B);
      }

      return 0; // default no-sort
    });

    // ----------------------------
    // 6. Pagination
    // ----------------------------
    const total = filtered.length;
    const paginated = filtered.slice(Number(skip), Number(skip) + Number(take));

    // nomor urut
    const list = paginated.map((item, index) => ({
      ...item,
      no: Number(skip) + index + 1,
    }));

    // ----------------------------
    // RETURN
    // ----------------------------
    return res.status(200).json({
      data: {
        list,
        pagination: {
          total: String(total),
          skip: Number(skip),
          take: Number(take),
          currentTotal: list.length,
        },
      },
      msg: "Get all data",
    });
  } catch (error) {
    console.error("Error rekap penjualan:", error);
    next(error);
  }
};




const user = async (req, res, next) => {
  try {
    const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of today (UTC, adjust timezone if needed)

      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999); // Set to end of today

      const pembelianAktif = await database.pembelian.count({
        where: {
          userId: req.user.id,
          status: 'PAID',
          expiredAt: {
            gte: today,
          },
        },
      });

      const totalPaketPembelian = await database.paketPembelian.count();

      const paketSaya =  await database.pembelian.count({
        where: {
          userId: req.user.id,
          status: 'PAID',
          expiredAt: {
            gte: today,
          },
        },
      });;
    const paketTersedia = await database.paketPembelian.count();
    const event = await database.event.count();
    const soal = await database.BankSoal.count({
      where: {
        deletedAt: null,
      },
    });
    const user = await database.User.count();
    const riwayatPembelian = await database.pembelian.count({
      where: {
        userId: req.user.id,
      },
    });

    const section = await database.homeSection.findMany({});

    const notifikasi = await database.notificationUser.findMany({
      where: {
        userId: req.user.id,
      },
      include: {
        notification: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        paketSaya,
        paketTersedia,
        event,
        riwayatPembelian,
        section,
        soal,
        user,
        notifikasi,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  admin,
  user,
  rekapPenjualan,
};