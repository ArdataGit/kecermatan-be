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
      kategoriSoalIsianId: Joi.number().allow(null),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const where = {
      ...filterToJson(validate),
    };

    if (validate.kategoriSoalIsianId) {
      where.kategoriSoalIsianId = validate.kategoriSoalIsianId;
    }

    const result = await database.$transaction([
      database.soalIsian.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: where,
        include: {
          kategoriSoalIsian: true,
        },
      }),
      database.soalIsian.count({
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

    const result = await database.soalIsian.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        kategoriSoalIsian: true,
      },
    });

    if (!result) throw new BadRequestError('Soal isian tidak ditemukan');

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengambil detail soal isian',
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      kategoriSoalIsianId: Joi.number().required(),
      soal: Joi.string().required(),
      jawaban: Joi.string().allow(null, ''),
    });

    const validate = await schema.validateAsync(req.body);

    const parentExist = await database.kategoriSoalIsian.findUnique({
      where: { id: validate.kategoriSoalIsianId },
    });
    if (!parentExist) throw new BadRequestError('Kategori Soal Isian tidak ditemukan');

    const result = await database.soalIsian.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan soal isian',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      kategoriSoalIsianId: Joi.number().allow(null),
      soal: Joi.string().allow(null, ''),
      jawaban: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync({
      ...req.body,
      ...req.params,
    });

    const isExist = await database.soalIsian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Soal isian tidak ditemukan');

    if (validate.kategoriSoalIsianId) {
      const parentExist = await database.kategoriSoalIsian.findUnique({
        where: { id: validate.kategoriSoalIsianId },
      });
      if (!parentExist) throw new BadRequestError('Kategori Soal Isian tidak ditemukan');
    }

    const result = await database.soalIsian.update({
      where: {
        id: validate.id,
      },
      data: {
        kategoriSoalIsianId: validate.kategoriSoalIsianId,
        soal: validate.soal,
        jawaban: validate.jawaban,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data soal isian',
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

    const isExist = await database.soalIsian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Soal isian tidak ditemukan');

    const result = await database.soalIsian.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus soal isian',
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
