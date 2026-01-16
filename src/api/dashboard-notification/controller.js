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
      title: Joi.string().max(100).allow('').optional(),
      description: Joi.string().required(),
      link: Joi.string().max(255).allow('').optional(),
      type: Joi.string().valid('info', 'success', 'warning', 'error').default('info'),
      priority: Joi.number().integer().min(0).default(0),
      status: Joi.string().valid('active', 'archived', 'deleted').default('active'),
    });

    const validate = await schema.validateAsync(
      {
        ...req.body,
      },
      {
        stripUnknown: true,
      }
    );

    // Ensure only one active notification exists
    if (validate.status === 'active') {
      await database.DashboardNotification.updateMany({
        where: { status: 'active' },
        data: { status: 'archived' },
      });
    }

    const notification = await database.DashboardNotification.create({
      data: {
        title: validate.title || null,
        description: validate.description,
        link: validate.link || null,
        type: validate.type,
        priority: validate.priority,
        status: validate.status,
      },
    });

    const result = await database.DashboardNotification.findUnique({
      where: { id: notification.id },
      select: {
        id: true,
        title: true,
        description: true,
        link: true,
        type: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      data: result,
      msg: 'Berhasil menambahkan notifikasi dashboard',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      title: Joi.string().max(100).allow('').optional(),
      description: Joi.string().required(),
      link: Joi.string().max(255).allow('').optional(),
      type: Joi.string().valid('info', 'success', 'warning', 'error').optional(),
      priority: Joi.number().integer().min(0).optional(),
      status: Joi.string().valid('active', 'archived', 'deleted').optional(),
    });

    const validate = await schema.validateAsync(
      {
        id: Number(req.params.id),
        ...req.body,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.DashboardNotification.findUnique({
      where: { id: validate.id },
    });

    if (!isExist) {
      throw new BadRequestError('Notifikasi dashboard tidak ditemukan');
    }

    // Ensure only one active notification exists
    if (validate.status === 'active') {
      await database.DashboardNotification.updateMany({
        where: { status: 'active', id: { not: validate.id } },
        data: { status: 'archived' },
      });
    }

    const notificationData = {
      title: validate.title || null,
      description: validate.description,
      link: validate.link || null,
      type: validate.type || isExist.type,
      priority: validate.priority !== undefined ? validate.priority : isExist.priority,
      status: validate.status || isExist.status,
    };

    const result = await database.DashboardNotification.update({
      where: { id: validate.id },
      data: notificationData,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah notifikasi dashboard',
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

    const isExist = await database.DashboardNotification.findUnique({
      where: { id: validate.id },
    });

    if (!isExist) {
      throw new BadRequestError('Notifikasi dashboard tidak ditemukan');
    }

    const result = await database.DashboardNotification.delete({
      where: { id: validate.id },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus notifikasi dashboard',
    });
  } catch (error) {
    next(error);
  }
};


const getNotifications = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number().default(0),
      take: Joi.number().default(10),
      sortBy: Joi.string().default('updatedAt'),
      descending: Joi.string().valid('true', 'false').default('true'),
      status: Joi.string().valid('active', 'archived', 'deleted').optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const where = validate.status ? { status: validate.status } : {};

    const sortOrder = validate.descending === 'true' ? 'desc' : 'asc';
    const result = await database.$transaction([
      database.DashboardNotification.findMany({
        where,
        skip: validate.skip,
        take: validate.take,
        orderBy: { [validate.sortBy]: sortOrder },
        select: {
          id: true,
          title: true,
          description: true,
          link: true,
          type: true,
          priority: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      database.DashboardNotification.count({ where }),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

const getActiveNotification = async (req, res, next) => {
  try {
    const result = await database.DashboardNotification.findFirst({
      where: { status: 'active' },
      select: {
        id: true,
        title: true,
        description: true,
        link: true,
        type: true,
        priority: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!result) {
      return res.status(200).json({
        data: null,
        msg: 'Tidak ada notifikasi aktif',
      });
    }

    return res.status(200).json({
      data: result,
      msg: 'Berhasil mengambil notifikasi aktif',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  insert,
  update,
  remove,
  getNotifications,
  getActiveNotification,
};