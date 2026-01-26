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
      bacaanId: Joi.number().allow(null),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const where = {
      ...filterToJson(validate),
    };

    if (validate.bacaanId) {
      where.bacaanId = validate.bacaanId;
    }

    const result = await database.$transaction([
      database.soalBacaan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: where,
        include: {
          bacaan: true,
        },
      }),
      database.soalBacaan.count({
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

    const result = await database.soalBacaan.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        bacaan: true,
      },
    });

    if (!result) throw new BadRequestError('Soal bacaan tidak ditemukan');

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengambil detail soal bacaan',
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      bacaanId: Joi.number().required(),
      soal: Joi.string().required(),
      jawaban: Joi.string().valid('Ya', 'Tidak').allow(null, ''),
    });

    const validate = await schema.validateAsync(req.body);

    const parentExist = await database.bacaan.findUnique({
      where: { id: validate.bacaanId },
    });
    if (!parentExist) throw new BadRequestError('Bacaan tidak ditemukan');

    const result = await database.soalBacaan.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan soal bacaan',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      bacaanId: Joi.number().allow(null),
      soal: Joi.string().allow(null, ''),
      jawaban: Joi.string().valid('Ya', 'Tidak').allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync({
      ...req.body,
      ...req.params,
    });

    const isExist = await database.soalBacaan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Soal bacaan tidak ditemukan');

    if (validate.bacaanId) {
      const parentExist = await database.bacaan.findUnique({
        where: { id: validate.bacaanId },
      });
      if (!parentExist) throw new BadRequestError('Bacaan tidak ditemukan');
    }

    const result = await database.soalBacaan.update({
      where: {
        id: validate.id,
      },
      data: {
        bacaanId: validate.bacaanId,
        soal: validate.soal,
        jawaban: validate.jawaban,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data soal bacaan',
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

    const isExist = await database.soalBacaan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Soal bacaan tidak ditemukan');

    const result = await database.soalBacaan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus soal bacaan',
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
