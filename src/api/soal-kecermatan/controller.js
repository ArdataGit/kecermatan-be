const Joi = require('joi');

const database = require('#database');
const { returnPagination, filterToJson } = require('#utils');
const { BadRequestError } = require('#errors');

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      kiasanId: Joi.number().allow(null),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const where = {
      ...filterToJson(validate),
    };

    if (validate.kiasanId) {
      where.kiasanId = validate.kiasanId;
    }

    const result = await database.$transaction([
      database.soalKecermatan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: where,
        include: {
          kiasan: true,
        },
      }),
      database.soalKecermatan.count({
        where: where,
      }),
    ]);

    return returnPagination(req, res, result);
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

    const result = await database.soalKecermatan.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        kiasan: true,
      },
    });

    if (!result) throw new BadRequestError('Soal Kecermatan tidak ditemukan');

    res.status(200).json({
      data: result,
      msg: 'Get data by id',
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      kiasanId: Joi.number().required(),
      soal: Joi.array().required(), // Validate as array (JSON)
      jawaban: Joi.string().required(),
      waktu: Joi.number().default(0),
    });

    const validate = await schema.validateAsync(req.body);

    const parentExist = await database.kiasan.findUnique({
      where: { id: validate.kiasanId },
    });
    if (!parentExist) throw new BadRequestError('Kiasan tidak ditemukan');

    const result = await database.soalKecermatan.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Soal Kecermatan',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      kiasanId: Joi.number().allow(null),
      soal: Joi.array().allow(null),
      jawaban: Joi.string().allow(null, ''),
      waktu: Joi.number().allow(null),
    });

    const validate = await schema.validateAsync({
      ...req.body,
      ...req.params,
    });

    const isExist = await database.soalKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Soal Kecermatan tidak ditemukan');

    if (validate.kiasanId) {
      const parentExist = await database.kiasan.findUnique({
        where: { id: validate.kiasanId },
      });
      if (!parentExist) throw new BadRequestError('Kiasan tidak ditemukan');
    }

    const result = await database.soalKecermatan.update({
      where: {
        id: validate.id,
      },
      data: {
        kiasanId: validate.kiasanId,
        soal: validate.soal,
        jawaban: validate.jawaban,
        waktu: validate.waktu,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data Soal Kecermatan',
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

    const isExist = await database.soalKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Soal Kecermatan tidak ditemukan');

    const result = await database.soalKecermatan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Soal Kecermatan',
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
};
