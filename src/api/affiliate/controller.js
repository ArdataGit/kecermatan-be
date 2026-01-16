const Joi = require("joi");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const crypto = require("crypto");
const database = require("#database");
const { BadRequestError, UnauthorizedError } = require("#errors");
const { returnPagination, generateToken, deleteFile , filterToJson} = require("#utils");

const simpleEncrypt = (text) => {
  const cipher = crypto.createCipher('aes256', 'affiliate-secret-key');
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
};

const simpleDecrypt = (encrypted) => {
  const decipher = crypto.createDecipher('aes256', 'affiliate-secret-key');
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// Helper: Recalculate balance berdasarkan pembelian referral
const recalculateAffiliateBalance = async (userId) => {
  const user = await database.user.findUnique({
    where: { id: userId },
    select: { affiliateCommission: true },
  });

  if (!user) return;

  const commissionRate = user.affiliateCommission;
  const isPercent = commissionRate <= 100;

  const referralPurchases = await database.pembelian.aggregate({
    where: {
      affiliateUserId: userId,
      status: "PAID",
    },
    _sum: { amount: true },
  });

  const totalSales = referralPurchases._sum.amount || 0;
  let newBalance = 0;

  if (isPercent) {
    newBalance = totalSales * (commissionRate / 100);
  } else {
    newBalance = commissionRate; // Fixed nominal
  }

  await database.user.update({
    where: { id: userId },
    data: { affiliateBalance: newBalance },
  });
};
const getMyAffiliateData = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new UnauthorizedError("User tidak ditemukan atau tidak authenticated");
    }

    const user = await database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        affiliateCode: true,
        affiliateLink: true,
        affiliateStatus: true,
        affiliateCommission: true,
        commissionType: true,
        affiliateBalance: true,
        createdAt: true,
      },
    });

    if (!user || !user.affiliateCode) {
      return res.status(404).json({
        status: false,
        message: "Akun affiliate tidak ditemukan atau belum aktif",
      });
    }

    // Riwayat referrals (pembelian dari user yang direferensikan)
    const referralsHistory = await database.pembelian.findMany({
      where: {
        affiliateUserId: userId,
        status: "PAID",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        affiliate_commission_amount: true,
        affiliate_commission_type: true,
        createdAt: true,
        paketPembelian: { select: { nama: true } },
        user: { select: { name: true, email: true } }, // Anonimkan jika perlu
      },
    });

    // Hitung total komisi dari referrals
    let totalKomisi = 0;
    const formattedReferrals = referralsHistory.map((item) => {
      const komisiAmount = parseFloat(item.affiliate_commission_amount || 0);
      const komisiType = item.affiliate_commission_type || 'percent';
      let komisi = 0;
      if (komisiType === 'percent') {
        komisi = Math.round(item.amount * (user.affiliateCommission / 100));
      } else {
        komisi = komisiAmount;
      }
      totalKomisi += komisi;

      return {
        ...item,
        komisi,
        komisi_formatted: komisi.toLocaleString("id-ID"),
        amount_formatted: item.amount.toLocaleString("id-ID"),
        created_at_formatted: moment(item.createdAt).format("DD/MM/YYYY HH:mm"),
        referred_user: item.user ? `${item.user.name} (${item.user.email})` : 'N/A',
      };
    });

    // Riwayat withdrawals
    const withdrawals = await database.affiliateWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        notes: true,
        processedAt: true,
        createdAt: true,
      },
    });

    const formattedWithdrawals = withdrawals.map((item) => ({
      ...item,
      amount_formatted: item.amount.toLocaleString("id-ID"),
      created_at_formatted: moment(item.createdAt).format("DD/MM/YYYY HH:mm"),
      processed_at_formatted: item.processedAt ? moment(item.processedAt).format("DD/MM/YYYY HH:mm") : null,
      status_label: item.status === "approved" ? "Disetujui" : item.status === "rejected" ? "Ditolak" : "Pending",
    }));

    // Hitung total withdrawn
    const totalWithdrawnAgg = await database.affiliateWithdrawal.aggregate({
      where: { userId, status: "approved" },
      _sum: { amount: true },
    });
    const totalWithdrawn = parseFloat(totalWithdrawnAgg._sum.amount || 0);

    // Jumlah referrals unik (user yang direferensikan)
    const uniqueReferrals = await database.user.count({
      where: {
        affiliateFromUserId: userId,
      },
    });

    res.status(200).json({
      status: true,
      data: {
        profile: user,
        referrals: {
          history: formattedReferrals,
          count: referralsHistory.length,
          unique_users: uniqueReferrals,
          total_komisi: totalKomisi,
          total_komisi_formatted: totalKomisi.toLocaleString("id-ID"),
        },
        withdrawals: {
          history: formattedWithdrawals,
          total_withdrawn: totalWithdrawn,
          total_withdrawn_formatted: totalWithdrawn.toLocaleString("id-ID"),
        },
        balance: {
          current: user.affiliateBalance,
          formatted: parseFloat(user.affiliateBalance).toLocaleString("id-ID"),
        },
        commission: {
          value: user.affiliateCommission,
          type: user.commissionType,
          label: user.commissionType === 'percent' ? `${user.affiliateCommission}%` : `Rp ${user.affiliateCommission.toLocaleString("id-ID")}`,
        },
      },
      message: "Data affiliate user berhasil diambil",
    });
  } catch (error) {
    next(error);
  }
};
const getAffiliateWithdrawalsByUserId = async (req, res, next) => {
  try {
    const { userId } = req.body; // Changed from req.params to req.body for POST
    const { skip = 0, take = 10, status } = req.query;
    const parsedUserId = parseInt(userId);
    const parsedSkip = parseInt(skip);
    const parsedTake = parseInt(take);
   
    if (isNaN(parsedUserId)) {
      throw new BadRequestError("userId harus berupa angka");
    }
   
    // Handle NaN untuk pagination
    const safeSkip = isNaN(parsedSkip) ? 0 : Math.max(0, parsedSkip);
    const safeTake = isNaN(parsedTake) ? 10 : Math.max(1, Math.min(100, parsedTake)); // Limit max 100 untuk performa
   
    // Validasi user ada dan punya affiliate
    const user = await database.user.findUnique({
      where: { id: parsedUserId },
      select: { id: true, name: true, affiliateCode: true },
    });
    if (!user) {
      throw new BadRequestError("User tidak ditemukan");
    }
    if (!user.affiliateCode) {
      return res.status(200).json({
        status: true,
        data: {
          history: [],
          total: 0,
          total_approved: 0,
          total_pending: 0,
          total_rejected: 0,
        },
        message: "User bukan affiliate",
      });
    }
   
    // Filter berdasarkan status (opsional)
    const baseWhere = { userId: parsedUserId };
    let where = { ...baseWhere };
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }
   
    // Ambil data withdrawals dengan pagination
    const [withdrawals, total] = await database.$transaction([
      database.affiliateWithdrawal.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: safeSkip,
        take: safeTake,
        select: {
          id: true,
          amount: true,
          status: true,
          notes: true,
          payload_destination: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      database.affiliateWithdrawal.count({ where }),
    ]);
   
    // Hitung agregasi per status (gunakan where base untuk overall summary, atau sync dengan filter jika diperlukan)
    // Di sini, kita gunakan baseWhere untuk summary overall (tidak tergantung filter status)
    const agg = await database.affiliateWithdrawal.groupBy({
      by: ["status"],
      where: baseWhere,
      _sum: { amount: true },
      _count: { id: true },
    });
   
    const totalApproved = agg.find((a) => a.status === "approved")?._sum?.amount || 0;
    const totalPending = agg.find((a) => a.status === "pending")?._count?.id || 0;
    const totalRejected = agg.find((a) => a.status === "rejected")?._count?.id || 0;
   
    // Optional: Jika ingin sum amount untuk pending/rejected juga
    // const totalPendingAmount = agg.find((a) => a.status === "pending")?._sum?.amount || 0;
    // const totalRejectedAmount = agg.find((a) => a.status === "rejected")?._sum?.amount || 0;
   
    // Format data
    const formattedWithdrawals = withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount,
      amount_formatted: w.amount.toLocaleString("id-ID"),
      status: w.status,
      status_label:
        w.status === "approved"
          ? "Disetujui"
          : w.status === "rejected"
          ? "Ditolak"
          : "Menunggu",
      notes: w.notes || "-",
      payload_destination: w.payload_destination || "-",
      createdAt: w.createdAt,
      created_at_formatted: moment(w.createdAt).format("DD/MM/YYYY HH:mm"),
      processedAt: w.processedAt,
      processed_at_formatted: w.processedAt
        ? moment(w.processedAt).format("DD/MM/YYYY HH:mm")
        : null,
    }));
   
    res.status(200).json({
      status: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          affiliateCode: user.affiliateCode,
        },
        history: formattedWithdrawals,
        pagination: {
          skip: safeSkip,
          take: safeTake,
          total,
        },
        summary: {
          total_withdrawals: total, // Ini adalah total filtered
          total_approved: totalApproved,
          total_approved_formatted: totalApproved.toLocaleString("id-ID"),
          total_pending: totalPending,
          total_rejected: totalRejected,
          // Optional: Tambah jika perlu
          // total_pending_amount: totalPendingAmount,
          // total_rejected_amount: totalRejectedAmount,
        },
      },
      message: "Riwayat pencairan berhasil diambil",
    });
  } catch (error) {
    next(error);
  }
};



const getAffiliateList = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string().allow(""),
      descending: Joi.boolean(),
      filters: Joi.object(),
    });

    const validate = await schema.validateAsync(req.query);

    const [users, total] = await database.$transaction([
      database.User.findMany({
        skip: validate.skip,
        take: validate.take,
        where: filterToJson(validate),
        orderBy: {
          [validate.sortBy || "id"]: validate.descending ? "desc" : "asc",
        },
        select: {
          id: true,
          name: true,
          email: true,
          affiliateCode: true,
          affiliateStatus: true,
          affiliateLink: true,
          createdAt: true,

          // ambil pembelian yg direferensikan user ini
          referredPurchases: {
            where: {
              affiliateUserId: { not: null },
              paidAt: { not: null },
            },
            select: {
              amount: true,
              affiliate_commission_amount: true,
              affiliate_commission_type: true,
            },
          },
        },
      }),

      database.User.count({
        where: filterToJson(validate),
      }),
    ]);

    // ✅ hitung total komisi per user
    const usersWithCommission = users.map((u) => {
      let totalKomisi = 0;

      for (const p of u.referredPurchases) {
        if (p.affiliate_commission_type === "nominal") {
          totalKomisi += Number(p.affiliate_commission_amount || 0);
        } else {
          // percent
          totalKomisi += Math.floor(
            (Number(p.amount) * Number(p.affiliate_commission_amount)) / 100
          );
        }
      }

      return {
        ...u,
        total_komisi: totalKomisi,
        total_komisi_formatted: `Rp ${totalKomisi.toLocaleString("id-ID")}`,
      };
    });

    return returnPagination(req, res, [usersWithCommission, total]);
  } catch (error) {
    next(error);
  }
};


const getAffiliateCommissionList = async (req, res, next) => {
  try {
    const { caridata, skip = 0, take = 20, sortBy = "affiliateCommission", descending = "true" } = req.query;
    const parsedSkip = parseInt(skip);
    const parsedTake = parseInt(take);

    let where = {
      affiliateCode: { not: null },
      affiliateStatus: "active",
    };

    if (caridata) {
      where.OR = [
        { name: { contains: caridata } },
        { affiliateCode: { contains: caridata } },
      ];
    }

    // Dynamic orderBy
    const orderDirection = descending === "true" ? "desc" : "asc";
    const orderBy = sortBy ? { [sortBy]: orderDirection } : { affiliateCommission: "desc" };

    const [data, total] = await database.$transaction([
      database.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          affiliateCode: true,
          affiliateCommission: true,
          affiliateBalance: true,
        },
        orderBy,
        skip: parsedSkip,
        take: parsedTake,
      }),
      database.user.count({ where }),
    ]);

    res.status(200).json({
      status: true,
      data,
      pagination: { skip: parsedSkip, take: parsedTake, total },
      message: "Daftar commission affiliate berhasil diambil",
    });
  } catch (error) {
    next(error);
  }
};

const generateAllAffiliateCodes = async (req, res, next) => {
  try {
    const users = await database.user.findMany({
      where: {
        affiliateCode: null,
      },
    });

    let generated = 0;
    const errors = [];

    for (const user of users) {
      let affiliateCode;
      let unique = false;
      let attempts = 0;
      const maxAttempts = 10; // Prevent infinite loops

      while (!unique && attempts < maxAttempts) {
        attempts++;
        affiliateCode = `AFF${moment().unix()}${Math.floor(Math.random() * 900 + 100)}`;
        const exists = await database.user.findFirst({  // Changed from findUnique to findFirst
          where: { affiliateCode },
        });
        if (!exists) unique = true;
      }

      if (!unique) {
        errors.push(`${user.name || user.email || 'Unknown'}: Gagal generate kode unik setelah ${maxAttempts} percobaan`);
        continue;
      }

      const updated = await database.user.update({
        where: { id: user.id },
        data: {
          affiliateCode,
          affiliateLink: `https://bimbel.fungsional.id/auth/register/${affiliateCode}`,
          affiliateStatus: "active",
          affiliateCommission: 0,
          affiliateBalance: 0.00,
        },
      });

      if (updated) generated++;
      else errors.push(user.name || user.email || 'Unknown');
    }

    res.status(200).json({
      status: generated > 0,
      message: generated > 0 ? `Berhasil generate ${generated} kode affiliate baru.` : "Tidak ada user yang perlu generate atau gagal proses.",
      data: { generated, errors },
    });
  } catch (error) {
    next(error);
  }
};
const createAffiliate = async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      name: Joi.string().required(),
      noWA: Joi.string().required(),
      jenisKelamin: Joi.string().required(),
      alamat: Joi.string().required(),
      provinsi: Joi.string().required(),
      kabupaten: Joi.string().required(),
      kecamatan: Joi.string().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.body);

    // Check email unique
    const existing = await database.user.findUnique({ where: { email: validate.email } });
    if (existing) throw new BadRequestError("Email sudah digunakan");

    let affiliateCode;
    let unique = false;
    while (!unique) {
      affiliateCode = `AFF${moment().unix()}${Math.floor(Math.random() * 900 + 100)}`;
      const exists = await database.user.findUnique({ where: { affiliateCode } });
      if (!exists) unique = true;
    }

    const password = bcrypt.hashSync(validate.email, 10); // Default password = email

    const newUser = await database.user.create({
      data: {
        email: validate.email,
        name: validate.name,
        noWA: validate.noWA,
        jenisKelamin: validate.jenisKelamin,
        alamat: validate.alamat,
        provinsi: validate.provinsi,
        kabupaten: validate.kabupaten,
        kecamatan: validate.kecamatan,
        password,
        affiliateCode,
        affiliateLink: `https://apps.utbk.or.id/buatakun/${affiliateCode}`,
        affiliateStatus: "active",
        affiliateCommission: 0,
        affiliateBalance: 0.00,
        affiliateFromUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.status(201).json({
      status: true,
      message: "Berhasil tambah affiliate",
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

const updateAffiliate = async (req, res, next) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      noWA: Joi.string().required(),
      jenisKelamin: Joi.string().required(),
      alamat: Joi.string().required(),
      provinsi: Joi.string().required(),
      kabupaten: Joi.string().required(),
      kecamatan: Joi.string().required(),
      affiliate_code: Joi.string().optional(),
      affiliate_status: Joi.string().valid("active", "inactive").required(),
    }).unknown(true);

    const validate = await schema.validateAsync({ ...req.body, id: parseInt(req.params.id) });

    let affiliateCode = validate.affiliate_code;
    if (!affiliateCode) {
      let unique = false;
      while (!unique) {
        affiliateCode = `AFF${moment().unix()}${Math.floor(Math.random() * 900 + 100)}`;
        const exists = await database.user.findUnique({ where: { affiliateCode } });
        if (!exists || exists.id === validate.id) unique = true;
      }
    }

    const updated = await database.user.update({
      where: { id: validate.id },
      data: {
        name: validate.name,
        noWA: validate.noWA,
        jenisKelamin: validate.jenisKelamin,
        alamat: validate.alamat,
        provinsi: validate.provinsi,
        kabupaten: validate.kabupaten,
        kecamatan: validate.kecamatan,
        affiliateCode,
        affiliateLink: `https://apps.utbk.or.id/buatakun/${affiliateCode}`,
        affiliateStatus: validate.affiliate_status,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      status: true,
      message: "Data affiliate berhasil diubah",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

const updateAffiliateCommission = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      commission_value: Joi.number().required(),
      commission_type: Joi.string().valid("percent", "nominal").default("percent"),
    }).unknown(true);

    const validate = await schema.validateAsync({
      ...req.body,
      id: parseInt(req.params.id),
    });

    const user = await database.user.findUnique({
      where: { id: validate.id },
    });

    if (!user) {
      throw new BadRequestError("User tidak ditemukan");
    }

    const commissionValue = parseFloat(validate.commission_value);

    // Validasi nilai komisi
    if (validate.commission_type === "percent" && commissionValue > 100) {
      throw new BadRequestError("Komisi persen tidak boleh lebih dari 100%");
    }
    if (commissionValue < 0) {
      throw new BadRequestError("Nilai komisi tidak boleh negatif");
    }

    // Update komisi affiliate
    await database.user.update({
      where: { id: validate.id },
      data: {
        affiliateCommission: commissionValue,
        commissionType: validate.commission_type,
      },
    });

    res.status(200).json({
      status: true,
      message: `Komisi berhasil diupdate. Nilai: ${commissionValue} (${validate.commission_type})`,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAffiliate = async (req, res, next) => {
  try {
    const { id } = req.params;

    await database.user.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      status: true,
      message: "Affiliate berhasil dihapus",
    });
  } catch (error) {
    next(error);
  }
};

const requestWithdraw = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().required(), // 🆕 ambil userId dari body
      amount: Joi.number().min(0).required(),
      notes: Joi.string().optional(),
      payload_destination: Joi.string().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.body);

    const user = await database.user.findUnique({
      where: { id: validate.userId },
    });

    if (!user) throw new BadRequestError("User tidak ditemukan");
    if (user.affiliateBalance < validate.amount) {
      throw new BadRequestError("Saldo tidak cukup");
    }

    const withdrawal = await database.affiliateWithdrawal.create({
      data: {
        userId: validate.userId,
        amount: validate.amount,
        status: "pending",
        notes: validate.notes || null,
        payload_destination: validate.payload_destination || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.status(201).json({
      status: true,
      message: "Permintaan pencairan berhasil diajukan",
      data: withdrawal,
    });
  } catch (error) {
    next(error);
  }
};

const getAffiliateHistory = async (req, res, next) => {
  try {
    const { encryptedId } = req.params;
    const userId = parseInt(simpleDecrypt(encryptedId));
    const user = await database.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestError("User tidak ditemukan");

    // Riwayat pembelian referral (sebagai transaksi)
    const history = await database.pembelian.findMany({
      where: {
        affiliateUserId: userId,
        status: "PAID",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        paketPembelian: { select: { nama: true } },
      },
    });

    // Riwayat withdrawal
    const withdrawals = await database.affiliateWithdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Hitung komisi di history
    const historyWithCommission = history.map(item => {
      const komisi = item.amount * (user.affiliateCommission / 100); // Asumsi persen
      return {
        ...item,
        komisi,
        komisi_formatted: komisi.toLocaleString("id-ID"),
        amount_formatted: item.amount.toLocaleString("id-ID"),
        created_at_formatted: moment(item.createdAt).format("DD/MM/YYYY HH:mm"),
        status_label: item.status === "PAID" ? "Success" : "Pending",
      };
    });

    res.status(200).json({
      status: true,
      data: historyWithCommission,
      withdrawals,
      user,
      message: "Riwayat berhasil diambil",
    });
  } catch (error) {
    next(error);
  }
};

const approveWithdraw = async (req, res, next) => {
  try {
    const { id } = req.params;

    const withdrawal = await database.affiliateWithdrawal.findUnique({
      where: { id: parseInt(id) },
    });
    if (!withdrawal || withdrawal.status !== "pending") {
      throw new BadRequestError("Withdrawal tidak ditemukan atau sudah diproses");
    }

    await database.$transaction([
      database.affiliateWithdrawal.update({
        where: { id: parseInt(id) },
        data: {
          status: "approved",
          processedAt: new Date(),
          updatedAt: new Date(),
        },
      }),
      database.user.update({
        where: { id: withdrawal.userId },
        data: { affiliateBalance: { decrement: withdrawal.amount } },
      }),
    ]);

    res.status(200).json({
      status: true,
      message: "Pencairan disetujui",
    });
  } catch (error) {
    next(error);
  }
};

const rejectWithdraw = async (req, res, next) => {
  try {
    const schema = Joi.object({
      notes: Joi.string().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.body);
    const { id } = req.params;

    const withdrawal = await database.affiliateWithdrawal.findUnique({
      where: { id: parseInt(id) },
    });
    if (!withdrawal || withdrawal.status !== "pending") {
      throw new BadRequestError("Withdrawal tidak ditemukan atau sudah diproses");
    }

    await database.affiliateWithdrawal.update({
      where: { id: parseInt(id) },
      data: {
        status: "rejected",
        notes: validate.notes || null,
        processedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      status: true,
      message: "Pencairan ditolak",
    });
  } catch (error) {
    next(error);
  }
};

const getUserWithdrawals = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const withdrawals = await database.affiliateWithdrawal.findMany({
      where: { userId: parseInt(userId) },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });

    const formatted = withdrawals.map(item => ({
      ...item,
      amount_formatted: item.amount.toLocaleString("id-ID"),
      created_at_formatted: moment(item.createdAt).format("DD/MM/YYYY HH:mm"),
      status_label: item.status,
    }));

    res.status(200).json({
      status: true,
      data: formatted,
      message: "Riwayat withdrawal berhasil diambil",
    });
  } catch (error) {
    next(error);
  }
};

const getAffiliateTransactionHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const history = await database.pembelian.findMany({
      where: {
        affiliateUserId: parseInt(userId),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        affiliate_commission_amount: true,
        affiliate_commission_type: true,
        paketPembelian: { select: { nama: true } },
      },
    });

    const formatted = history.map(item => {
      let komisi = 0;
      if (item.status === "PAID") {
        if (item.affiliate_commission_type === "percent") {
          komisi = item.amount * (parseFloat(item.affiliate_commission_amount.toString()) / 100);
        } else {
          // nominal
          komisi = parseFloat(item.affiliate_commission_amount.toString());
        }
      }
      return {
        ...item,
        amount_formatted: item.amount.toLocaleString("id-ID"),
        komisi,
        komisi_formatted: komisi.toLocaleString("id-ID"),
        status_label: item.status === "PAID" ? "Success" : item.status === "FAILED" ? "Failed" : "Pending",
        created_at_formatted: moment(item.createdAt).format("DD/MM/YYYY HH:mm"),
      };
    });

    res.status(200).json({
      status: true,
      data: formatted,
      message: "Riwayat transaksi affiliate berhasil diambil",
    });
  } catch (error) {
    next(error);
  }
};

const massUpdateCommission = async (req, res, next) => {
  try {
    const schema = Joi.object({
      commission_value: Joi.number().required(),
      commission_type: Joi.string().valid("percent", "nominal").required(),
    });

    const validate = await schema.validateAsync(req.body);

    const { commission_value, commission_type } = validate;

    // Validasi nilai komisi
    if (commission_type === "percent" && commission_value > 100) {
      throw new BadRequestError("Komisi persen tidak boleh lebih dari 100%");
    }
    if (commission_value < 0) {
      throw new BadRequestError("Nilai komisi tidak boleh negatif");
    }

    // Update semua user yang punya kode affiliate
    const result = await database.user.updateMany({
      where: { affiliateCode: { not: null } }, // hanya user affiliate
      data: {
        affiliateCommission: commission_value,
        commissionType: commission_type,
        updatedAt: new Date(),
      },
    });

    res.status(200).json({
      status: true,
      message: `Berhasil update komisi untuk ${result.count} user. Nilai: ${commission_value} (${commission_type})`,
    });
  } catch (error) {
    next(error);
  }
};

const getAffiliateData = async (req, res, next) => {
  try {
    const { id } = req.params; 
    const userId = parseInt(id);

    const user = await database.user.findUnique({
      where: { id: userId },
      include: {
        affiliateToUsers: {
          include: {
            Pembelian: {
              where: { status: 'PAID' },
              select: {
                id: true,
                amount: true,
                affiliate_commission_amount: true,
                affiliate_commission_type: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.affiliateCode) {
      return res.status(404).json({
        status: false,
        message: 'Affiliate user tidak ditemukan',
      });
    }

    const referrals = user.affiliateToUsers.map((referredUser) => {
      const purchases = referredUser.Pembelian || [];
      const pembelianCount = purchases.length;

      let totalKomisi = 0;

      purchases.forEach((purchase) => {
        const komisiVal = parseFloat(purchase.affiliate_commission_amount || 0);
        const amount = parseFloat(purchase.amount || 0);
        const type = purchase.affiliate_commission_type;

        if (type === 'percent') {
          totalKomisi += Math.round(amount * (komisiVal / 100));
        } else {
          totalKomisi += komisiVal;
        }
      });

      return {
        id: referredUser.id,
        name: referredUser.name || 'N/A',
        email: referredUser.email,
        created_at: referredUser.createdAt,
        pembelian_count: pembelianCount,
        total_komisi: totalKomisi,
      };
    });

    const totalWithdrawnAgg = await database.affiliateWithdrawal.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true },
    });

    const totalWithdrawn = parseFloat(totalWithdrawnAgg._sum.amount || 0);

    const pendingWithdrawals = await database.affiliateWithdrawal.findMany({
      where: { userId, status: 'pending' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      status: true,
      data: {
        referrals,
        total_withdrawn: totalWithdrawn,
        pending_withdrawals: pendingWithdrawals,
      },
      message: 'Data affiliate berhasil diambil',
    });
  } catch (error) {
    next(error);
  }
};
const getAllAffiliateWithdrawals = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number().min(0).default(0),
      take: Joi.number().min(1).max(100).default(20),
      status: Joi.string().valid('pending', 'approved', 'rejected').optional(),
      sortBy: Joi.string().valid('createdAt', 'amount', 'status', 'processedAt').default('createdAt'),
      descending: Joi.boolean().default(true),
      caridata: Joi.string().allow('').optional(), // Search by user name or email
      startDate: Joi.date().optional(), // Filter by date range
      endDate: Joi.date().optional(),
    });

    const validate = await schema.validateAsync(req.query);

    // Build where clause
    const where = {};
    
    // Filter by status
    if (validate.status) {
      where.status = validate.status;
    }

    // Filter by date range
    if (validate.startDate || validate.endDate) {
      where.createdAt = {};
      if (validate.startDate) {
        where.createdAt.gte = new Date(validate.startDate);
      }
      if (validate.endDate) {
        where.createdAt.lte = new Date(validate.endDate);
      }
    }

    // Search by user name or email
    if (validate.caridata) {
      where.user = {
        OR: [
          { name: { contains: validate.caridata } },
          { email: { contains: validate.caridata } },
        ],
      };
    }

    // Build orderBy
    const orderDirection = validate.descending ? 'desc' : 'asc';
    const orderBy = { [validate.sortBy]: orderDirection };

    // Fetch data with pagination
    const [withdrawals, total] = await database.$transaction([
      database.affiliateWithdrawal.findMany({
        where,
        orderBy,
        skip: validate.skip,
        take: validate.take,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              affiliateCode: true,
              affiliateBalance: true,
            },
          },
        },
      }),
      database.affiliateWithdrawal.count({ where }),
    ]);

    // Get summary statistics
    const summaryAgg = await database.affiliateWithdrawal.groupBy({
      by: ['status'],
      where: validate.status ? where : {}, // Use all data for summary if no status filter
      _sum: { amount: true },
      _count: { id: true },
    });

    const summary = {
      total_withdrawals: total,
      pending: {
        count: summaryAgg.find(s => s.status === 'pending')?._count?.id || 0,
        amount: parseFloat(summaryAgg.find(s => s.status === 'pending')?._sum?.amount || 0),
      },
      approved: {
        count: summaryAgg.find(s => s.status === 'approved')?._count?.id || 0,
        amount: parseFloat(summaryAgg.find(s => s.status === 'approved')?._sum?.amount || 0),
      },
      rejected: {
        count: summaryAgg.find(s => s.status === 'rejected')?._count?.id || 0,
        amount: parseFloat(summaryAgg.find(s => s.status === 'rejected')?._sum?.amount || 0),
      },
    };

    // Format data for response
    const formattedWithdrawals = withdrawals.map(w => ({
      id: w.id,
      userId: w.userId,
      user: {
        id: w.user.id,
        name: w.user.name,
        email: w.user.email,
        affiliateCode: w.user.affiliateCode,
        affiliateBalance: parseFloat(w.user.affiliateBalance),
        affiliateBalance_formatted: parseFloat(w.user.affiliateBalance).toLocaleString('id-ID'),
      },
      amount: parseFloat(w.amount),
      amount_formatted: `Rp ${parseFloat(w.amount).toLocaleString('id-ID')}`,
      status: w.status,
      status_label: w.status === 'approved' ? 'Disetujui' : w.status === 'rejected' ? 'Ditolak' : 'Menunggu',
      notes: w.notes || '-',
      payload_destination: w.payload_destination || '-',
      createdAt: w.createdAt,
      created_at_formatted: moment(w.createdAt).format('DD/MM/YYYY HH:mm'),
      processedAt: w.processedAt,
      processed_at_formatted: w.processedAt 
        ? moment(w.processedAt).format('DD/MM/YYYY HH:mm') 
        : null,
    }));

    // Format summary for display
    const formattedSummary = {
      ...summary,
      pending: {
        ...summary.pending,
        amount_formatted: `Rp ${summary.pending.amount.toLocaleString('id-ID')}`,
      },
      approved: {
        ...summary.approved,
        amount_formatted: `Rp ${summary.approved.amount.toLocaleString('id-ID')}`,
      },
      rejected: {
        ...summary.rejected,
        amount_formatted: `Rp ${summary.rejected.amount.toLocaleString('id-ID')}`,
      },
      total_amount: summary.pending.amount + summary.approved.amount + summary.rejected.amount,
      total_amount_formatted: `Rp ${(summary.pending.amount + summary.approved.amount + summary.rejected.amount).toLocaleString('id-ID')}`,
    };

   return res.status(200).json({
      status: true,
      data: {
        list: formattedWithdrawals, // ✅ langsung array
        summary: formattedSummary,
        message: 'Data pencairan affiliate berhasil diambil',
        pagination: {
          skip: validate.skip,
          take: validate.take,
          total,
          totalPages: Math.ceil(total / validate.take),
          currentPage: Math.floor(validate.skip / validate.take) + 1,
        }
      }
    });
  } catch (error) {
    next(error);
  }
};




module.exports = {
  // Affiliate
  getAffiliateList,
  getAffiliateCommissionList,
  generateAllAffiliateCodes,
  createAffiliate,
  updateAffiliate,
  updateAffiliateCommission,
  deleteAffiliate,
  requestWithdraw,
  getAffiliateHistory,
  approveWithdraw,
  rejectWithdraw,
  getUserWithdrawals,
  getAffiliateTransactionHistory,
  massUpdateCommission,getAffiliateData,
  getMyAffiliateData,
  getAffiliateWithdrawalsByUserId,
  getAllAffiliateWithdrawals,
};