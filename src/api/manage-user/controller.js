const Joi = require("joi");
const moment = require("moment");
const bcrypt = require("bcryptjs");
const excelJS = require("exceljs");

const database = require("#database");
const { returnPagination, sendMail, filterToJson } = require("#utils");
const { BadRequestError } = require("#errors");

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string().allow(""),
      descending: Joi.boolean(),
      filters: Joi.object(),
    });

    const validate = await schema.validateAsync(req.query);

    const users = await database.User.findMany({
      skip: validate.skip,
      take: validate.take,
      where: filterToJson(validate),
      orderBy: {
        [validate.sortBy]: validate.descending ? "desc" : "asc",
      },
      include: {
        // 1. USER YANG MEMAKAI REFERAL USER INI
        affiliateToUsers: {
          where: {
            Pembelian: {
              some: {}        // ambil hanya user yg punya pembelian
            }
          },
          include: {
            Pembelian: true
          }
        },

        // 2. PEMBELIAN PAID YANG DIREFERALKAN KE USER INI
        referredPurchases: {
          where: { status: "PAID" },
          include: {
            paketPembelian: true,
            user: true
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });

    const total = await database.User.count({
      where: filterToJson(validate),
    });

    return returnPagination(req, res, [users, total]);

  } catch (error) {
    next(error);
  }
};


const excel = async (req, res, next) => {
  try {
    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users");

    const User = await database.User.findMany({});

    worksheet.columns = [
      { header: "Nama Lengkap", key: "name", width: 15 },
      { header: "Email", key: "email", width: 15 },
      { header: "Nomor Telepon", key: "noWA", width: 15 },
      { header: "Alamat", key: "alamat", width: 15 },
      { header: "Provinsi", key: "provinsi", width: 15 },
      { header: "Kabupaten", key: "kabupaten", width: 15 },
      { header: "Kecamatan", key: "kecamatan", width: 15 },
      { header: "Role", key: "role", width: 10 },
      { header: "Tanggal Bergabung", key: "createdAt", width: 25 },
    ];
    User.forEach((user) => {
      worksheet.addRow({
        ...user,
        createdAt: moment(user.createdAt).format("DD-MM-YYYY HH:mm"),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=users.xlsx");

    workbook.xlsx.write(res).then(() => res.end());
  } catch (error) {
    next(error);
  }
};

const find = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.params);

    const result = await database.User.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!result) throw new BadRequestError("User dengan tidak ditemukan");

    res.status(200).json({
      data: result,
      msg: "Get data by id",
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().required().min(8),
    noWA: Joi.string().allow(""),
    jenisKelamin: Joi.string().allow(""),
    alamat: Joi.string().allow(""),
    provinsi: Joi.string().allow(""),
    kabupaten: Joi.string().allow(""),
    kecamatan: Joi.string().allow(""),
    affiliate_code: Joi.string().allow(null, ""), // Tambahkan validasi untuk kode affiliate
  });

  try {
    const validate = await schema.validateAsync(req.body);

    // Cek apakah email sudah digunakan
    const isEmailExist = await database.User.findUnique({
      where: { email: validate.email },
    });
    if (isEmailExist) throw new BadRequestError("Email telah digunakan");

    // Cek apakah noWA sudah digunakan jika diisi
    if (validate.noWA) {
      const isNoWAExist = await database.User.findFirst({
        where: { noWA: validate.noWA },
      });
      if (isNoWAExist) throw new BadRequestError("No Whatsapp telah digunakan");
    }

    // Cek kode affiliate (referrer)
    let affiliateFromUserId = null;
    if (validate.affiliate_code) {
      const referrerUser = await database.User.findFirst({
        where: { affiliateCode: validate.affiliate_code },
      });
      if (referrerUser) {
        affiliateFromUserId = referrerUser.id;
      }
    }

    // Generate affiliateCode unik untuk user baru
    let affiliateCode;
    let unique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!unique && attempts < maxAttempts) {
      attempts++;
      affiliateCode = `AFFU${moment().unix()}${Math.floor(Math.random() * 900 + 100)}`;
      const exists = await database.User.findFirst({
        where: { affiliateCode },
      });
      if (!exists) unique = true;
      else await new Promise((r) => setTimeout(r, 50));
    }

    if (!unique) throw new BadRequestError("Gagal membuat kode afiliasi unik. Silakan coba lagi.");

    // Buat user baru
    const result = await database.User.create({
      data: {
        ...validate,
        verifyAt: new Date(),
        password: bcrypt.hashSync(validate.password, 10),
        affiliateFromUserId, // Tambahkan dari referrer
        affiliateCode,
        affiliateLink: `https://viracun.com/auth/register/${affiliateCode}`, // Sesuaikan domain dengan aplikasi Anda
        affiliateStatus: "active",
        affiliateCommission: 0,
        affiliateBalance: 0.0,
      },
    });

    // Kirim email konfirmasi (diubah ke konfirmasi email seperti contoh)
    const token = generateToken(result); // Asumsi generateToken tersedia
    sendMail({
      to: validate.email,
      subject: "Please Confirm Your Email",
      template: "register.html", // TODO: Ubah ke template konfirmasi jika diperlukan
      name: validate.name,
      url: `${process.env.URL_SERVER}/auth/confirm-email/${token}`, // Asumsi env var tersedia
    });

    res.status(201).json({
      data: result,
      msg: "Create data",
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      name: Joi.string().required(),
      noWA: Joi.string().allow(""),
      jenisKelamin: Joi.string().allow(""),
      alamat: Joi.string().allow(""),
      provinsi: Joi.string().allow(""),
      kabupaten: Joi.string().allow(""),
      kecamatan: Joi.string().allow(""),
      password: Joi.string().min(8).allow(""),
      email: Joi.string().email(),
      verifyAt: Joi.date().allow(null, ""),

      // optional, boleh kosong
      affiliateFromUserId: Joi.alternatives().try(Joi.number(), Joi.valid(null)).allow(""),
    }).unknown();

    const validate = await schema.validateAsync({
      ...req.params,
      ...req.body,
    });

    // Konversi empty value untuk verifyAt
    if (validate.verifyAt === "") validate.verifyAt = null;

    // Hapus affiliateFromUserId jika kosong/null
    if (
      validate.affiliateFromUserId === "" ||
      validate.affiliateFromUserId === null ||
      typeof validate.affiliateFromUserId === "undefined"
    ) {
      delete validate.affiliateFromUserId;
    }

    const isExist = await database.User.findUnique({
      where: { id: validate.id },
    });

    if (!isExist) throw new BadRequestError("User tidak ditemukan");

    // Cek email duplikat
    if (validate.email && validate.email !== isExist.email) {
      const isEmailExist = await database.User.findUnique({
        where: { email: validate.email },
      });
      if (isEmailExist) throw new BadRequestError("Email telah digunakan");
    }

    // Hash password jika dikirim
    if (validate.password) {
      validate.password = bcrypt.hashSync(validate.password, 10);
    } else {
      delete validate.password;
    }

    const result = await database.User.update({
      where: { id: validate.id },
      data: { ...validate },
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil mengubah data user",
    });

  } catch (error) {
    next(error);
  }
};


const remove = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.params);

    const isExist = await database.User.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError("User tidak ditemukan");

    const result = await database.User.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil menghapus data user",
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  get,
  find,
  insert,
  update,
  remove,
  excel,
};
