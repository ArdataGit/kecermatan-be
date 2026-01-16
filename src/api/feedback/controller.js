const Joi = require('joi');
const moment = require('moment');
const excelJS = require('exceljs');
const { default: readXlsxFile } = require('read-excel-file/node');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { returnPagination } = require('#utils');
const { BadRequestError } = require('#errors');

const database = new PrismaClient();

/* ================= FEEDBACKS ================= */

const insertFeedback = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().required(),
      pekerjaan: Joi.string().allow('').optional(),
      rating: Joi.number().min(1).max(5).required(),
      saran: Joi.string().allow('').optional(),
    });

    const validate = await schema.validateAsync(req.body, { stripUnknown: true });

    const user = await database.User.findUnique({
      where: { id: validate.userId },
    });
    if (!user) throw new BadRequestError('User tidak ditemukan');

    // cek apakah user sudah pernah kasih feedback (unique constraint)
    const existing = await database.feedback.findUnique({
      where: { userId: validate.userId },
    });
    if (existing) throw new BadRequestError('User sudah pernah mengisi feedback');

    const feedback = await database.feedback.create({
      data: {
        userId: validate.userId,
        pekerjaan: validate.pekerjaan,
        rating: validate.rating,
        saran: validate.saran,
      },
    });

    res.status(201).json({ data: feedback, msg: 'Feedback berhasil disimpan' });
  } catch (error) {
    next(error);
  }
};

const updateFeedback = async (req, res, next) => {
  try {
    const schema = Joi.object({
      pekerjaan: Joi.string().allow('').optional(),
      rating: Joi.number().min(1).max(5).optional(),
      saran: Joi.string().allow('').optional(),
    });

    const validate = await schema.validateAsync(req.body, { stripUnknown: true });

    const isExist = await database.feedback.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!isExist) throw new BadRequestError('Feedback tidak ditemukan');

    const feedback = await database.feedback.update({
      where: { id: Number(req.params.id) },
      data: validate,
    });

    res.status(200).json({ data: feedback, msg: 'Feedback berhasil diperbarui' });
  } catch (error) {
    next(error);
  }
};

const removeFeedback = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const isExist = await database.feedback.findUnique({ where: { id } });
    if (!isExist) throw new BadRequestError('Feedback tidak ditemukan');

    const result = await database.feedback.delete({ where: { id } });
    res.status(200).json({ data: result, msg: 'Feedback berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};


const getFeedbacks = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number().default(0),
      take: Joi.number().default(10),
      descending: Joi.string().valid('true', 'false').default('true'),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const sortOrder = validate.descending === 'true' ? 'desc' : 'asc';

    const result = await database.$transaction([
      database.feedback.findMany({
        skip: validate.skip,
        take: validate.take,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      database.feedback.count(),
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    console.error('Error in getFeedbacks:', error);
    next(error);
  }
};


const checkUserFeedback = async (req, res, next) => {
  try {
    const schema = Joi.object({
      userId: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.query, { stripUnknown: true });

    const user = await database.User.findUnique({
      where: { id: validate.userId },
    });
    if (!user) throw new BadRequestError('User tidak ditemukan');

    const feedback = await database.feedback.findUnique({
      where: { userId: validate.userId },
    });

    res.status(200).json({
      data: { hasFeedback: !!feedback },
      msg: feedback ? 'User sudah mengisi feedback' : 'User belum mengisi feedback',
    });
  } catch (error) {
    next(error);
  }
};
/* ================= FEEDBACK SETTING ================= */

const insertFeedbackSetting = async (req, res, next) => {
  try {
    const schema = Joi.object({
      key: Joi.string().required(),
      value: Joi.string().required(),
    });
    const validate = await schema.validateAsync(req.body, { stripUnknown: true });

    const setting = await database.feedbackSetting.create({
      data: {
        isActive: true, // atau false
      },
    });    res.status(201).json({ data: setting, msg: 'Setting feedback berhasil dibuat' });
  } catch (error) {
    next(error);
  }
};

const updateFeedbackSetting = async (req, res, next) => {
  try {
    const schema = Joi.object({
      isActive: Joi.boolean().required(),
    });
    const validate = await schema.validateAsync(req.body, { stripUnknown: true });

    let setting = await database.feedbackSetting.findFirst();
    if (!setting) {
      setting = await database.feedbackSetting.create({
        data: { isActive: validate.isActive },
      });
    } else {
      setting = await database.feedbackSetting.update({
        where: { id: setting.id },
        data: { isActive: validate.isActive },
      });
    }

    res.status(200).json({ data: setting, msg: 'Setting feedback berhasil diperbarui' });
  } catch (error) {
    next(error);
  }
};

const getFeedbackSettings = async (req, res, next) => {
  try {
    const result = await database.feedbackSetting.findMany();
    res.status(200).json({ data: result });
  } catch (error) {
    next(error);
  }
};

const removeFeedbackSetting = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const isExist = await database.feedbackSetting.findUnique({ where: { id } });
    if (!isExist) throw new BadRequestError('Setting tidak ditemukan');

    const result = await database.feedbackSetting.delete({ where: { id } });
    res.status(200).json({ data: result, msg: 'Setting feedback berhasil dihapus' });
  } catch (error) {
    next(error);
  }
};

/* ================= EXPORT ================= */

module.exports = {
  // Feedback
  insertFeedback,
  updateFeedback,
  removeFeedback,
  getFeedbacks,
  checkUserFeedback,
  // feedback_setting
  insertFeedbackSetting,
  updateFeedbackSetting,
  getFeedbackSettings,
  removeFeedbackSetting,
};