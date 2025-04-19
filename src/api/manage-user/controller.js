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
    const result = await database.$transaction([
      database.User.findMany({
        skip: validate.skip,
        take: validate.take,
        where: filterToJson(validate),
        orderBy: {
          [validate.sortBy]: validate.descending ? "desc" : "asc",
        },
      }),
      database.User.count({
        where: filterToJson(validate),
      }),
    ]);

    return returnPagination(req, res, result);
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
  try {
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
    });

    const validate = await schema.validateAsync(req.body);

    const isEmailExist = await database.User.findUnique({
      where: {
        email: validate.email,
      },
    });

    if (isEmailExist) throw new BadRequestError("Email telah digunakan");

    const result = await database.User.create({
      data: {
        ...validate,
        verifyAt: new Date(),
        password: bcrypt.hashSync(validate.password, 10),
      },
    });

    sendMail({
      to: validate.email,
      subject: "Welcome to Viracun",
      template: "register.html", // -todo: change the template welcome.html
      name: validate.name,
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
    }).unknown();

    const validate = await schema.validateAsync({
      ...req.params,
      ...req.body,
    });

    const isExist = await database.User.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (validate.email && validate.email !== isExist.email) {
      const isEmailExist = await database.User.findUnique({
        where: {
          email: validate.email,
        },
      });

      if (isEmailExist) throw new BadRequestError("Email telah digunakan");
    }

    if (validate.password) {
      validate.password = bcrypt.hashSync(validate.password, 10);
    } else {
      delete validate.password;
    }
    if (!isExist) throw new BadRequestError("User tidak ditemukan");

    const result = await database.User.update({
      where: {
        id: validate.id,
      },
      data: {
        ...validate,
      },
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
