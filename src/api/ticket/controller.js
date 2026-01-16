const Joi = require('joi');
const moment = require('moment');
const excelJS = require('exceljs');
const { default: readXlsxFile } = require('read-excel-file/node');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { returnPagination } = require('#utils');
const { BadRequestError } = require('#errors');

const database = new PrismaClient();

const insert = async (req, res, next) => {
  try {

    const schema = Joi.object({
      userId: Joi.number().required(),
      title: Joi.string().required(),
      description: Joi.string().required(),
      category: Joi.string().allow('').optional(),
      status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').default('open'),
      image: Joi.string().allow(null).optional(),
    });

    const validate = await schema.validateAsync(
      {
        ...req.body,
        image: req.file?.path,
      },
      {
        stripUnknown: true,
      }
    );

    const user = await database.User.findUnique({
      where: { id: parseInt(validate.userId) },
    });
    if (!user) {
      throw new BadRequestError('User tidak ditemukan');
    }

    const ticketData = {
      title: validate.title,
      description: validate.description,
      category: validate.category || null,
      status: validate.status,
      image: validate.image || null,
      user: { connect: { id: parseInt(validate.userId) } },
    };

    const ticket = await database.tickets.create({
      data: ticketData,
    });

    const result = await database.tickets.findUnique({
      where: { id: ticket.id },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        image: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      data: {
        ...result,
        image: result.image ? `${process.env.BASE_URL}/${result.image}` : null,
      },
      msg: 'Berhasil menambahkan ticket',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().required(),
      title: Joi.string().required(),
      description: Joi.string().required(),
      category: Joi.string().allow('').optional(),
      status: Joi.string().valid('open', 'in_progress', 'resolved', 'closed').optional(),
      adminResponse: Joi.string().allow('').optional(),
      image: Joi.string().allow(null).optional(),
    });

    const validate = await schema.validateAsync(
      {
        ...req.body,
        image: req.file?.path || null,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.tickets.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!isExist) {
      throw new BadRequestError('Ticket tidak ditemukan');
    }

    // Check if user exists
    const user = await database.User.findUnique({
      where: { id: parseInt(validate.userId) },
    });
    if (!user) {
      throw new BadRequestError('User tidak ditemukan');
    }

    const ticketData = {
      title: validate.title,
      description: validate.description,
      category: validate.category || null,
      status: validate.status || isExist.status,
      adminResponse: validate.adminResponse || null,
      image: validate.image,
      user: { connect: { id: parseInt(validate.userId) } },
    };

    const result = await database.tickets.update({
      where: { id: Number(req.params.id) },
      data: ticketData,
    });

    res.status(200).json({
      data: {
        ...result,
        image: result.image ? `${process.env.BASE_URL}/${result.image}` : null,
      },
      msg: 'Berhasil mengubah ticket',
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

    const validate = await schema.validateAsync({ ...req.params, ...req.body });

    const isExist = await database.tickets.findUnique({
      where: { id: validate.id },
    });

    if (!isExist) {
      throw new BadRequestError('Ticket tidak ditemukan');
    }


    const result = await database.tickets.delete({
      where: { id: validate.id },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus ticket',
    });
  } catch (error) {
    next(error);
  }
};

const excel = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().optional(),
    });

    const validate = await schema.validateAsync(req.params);

    const tickets = await database.tickets.findMany({
      where: validate.userId ? { userId: Number(validate.userId) } : {},
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    const workbook = new excelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tickets');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'User Name', key: 'userName', width: 20 },
      { header: 'User Email', key: 'userEmail', width: 20 },
      { header: 'Title', key: 'title', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Category', key: 'category', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Image', key: 'image', width: 20 },
      { header: 'Admin Response', key: 'adminResponse', width: 30 },
      { header: 'Created At', key: 'createdAt', width: 25 },
    ];

    tickets.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        userName: item.user?.name || '-',
        userEmail: item.user?.email || '-',
        title: item.title,
        description: item.description,
        category: item.category || '-',
        status: item.status,
        image: item.image ? `${process.env.BASE_URL}/${item.image}` : '-',
        adminResponse: item.adminResponse || '-',
        createdAt: moment(item.createdAt).format('DD-MM-YYYY HH:mm'),
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename=tickets.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

const importExcel = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().optional(),
    });

    const validate = await schema.validateAsync(req.params);

    const exFile = `${__dirname}/../../../${req.file.path}`;
    const errors = [];

    const rows = await readXlsxFile(fs.createReadStream(exFile));
    rows.shift(); // Remove header row

    for (const [index, row] of rows.entries()) {
      const [userId, title, description, category, status] = row;

      if (!userId || isNaN(userId)) {
        errors.push(`Row ${index + 1}: User ID harus diisi dan berupa angka`);
        continue;
      }
      if (!title) {
        errors.push(`Row ${index + 1}: Title harus diisi`);
        continue;
      }
      if (!description) {
        errors.push(`Row ${index + 1}: Description harus diisi`);
        continue;
      }
      if (status && !['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        errors.push(
          `Row ${index + 1}: Status harus salah satu dari: open, in_progress, resolved, closed`
        );
        continue;
      }

      const user = await database.User.findUnique({
        where: { id: Number(userId) },
      });
      if (!user) {
        errors.push(`Row ${index + 1}: User ID ${userId} tidak ditemukan`);
        continue;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        errors,
        msg: 'Gagal import data',
      });
    }

    for (const row of rows) {
      const [userId, title, description, category, status] = row;
      await database.tickets.create({
        data: {
          userId: Number(userId),
          title,
          description,
          category: category || null,
          status: status || 'open',
        },
      });
    }

    return res.status(200).json({
      msg: 'Berhasil import data',
    });
  } catch (error) {
    next(error);
  }
};

const getTickets = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number().default(0),
      take: Joi.number().default(10),
      sortBy: Joi.string().default('updatedAt'),
      descending: Joi.string().valid('true', 'false').default('true'),
      userId: Joi.number().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const where = validate.userId ? { userId: Number(validate.userId) } : {};

    const sortOrder = validate.descending === 'true' ? 'desc' : 'asc';
    const result = await database.$transaction([
      database.tickets.findMany({
        where,
        skip: validate.skip,
        take: validate.take,
        orderBy: { [validate.sortBy]: sortOrder },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      }),
      database.tickets.count({ where }),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

const getTicketsForUser = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().required(),
      skip: Joi.number().default(0),
      take: Joi.number().default(10),
      sortBy: Joi.string().default('updatedAt'),
      descending: Joi.string().valid('true', 'false').default('true'),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const user = await database.User.findUnique({
      where: { id: Number(validate.userId) },
    });
    if (!user) {
      throw new BadRequestError('User tidak ditemukan');
    }

    const where = { userId: Number(validate.userId) };

    const sortOrder = validate.descending === 'true' ? 'desc' : 'asc';
    const result = await database.$transaction([
      database.tickets.findMany({
        where,
        skip: validate.skip,
        take: validate.take,
        orderBy: { [validate.sortBy]: sortOrder },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      database.tickets.count({ where }),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  insert,
  update,
  remove,
  excel,
  importExcel,
  getTickets,
  getTicketsForUser,
};
