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
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const result = await database.$transaction([
      database.kategoriSoalKecermatan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
        },
        include: {
          _count: {
            select: {
              Kiasan: true,
            },
          },
        },
        include: {
          _count: {
            select: {
              Kiasan: true,
            },
          },
        },
      }),
      database.kategoriSoalKecermatan.count({
        where: filterToJson(validate),
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

    const result = await database.kategoriSoalKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!result) throw new BadRequestError('Kategori tidak ditemukan');

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
      judul_kategori: Joi.string().required(),
      keterangan: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync(req.body);

    const result = await database.kategoriSoalKecermatan.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Kategori Kecermatan',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      judul_kategori: Joi.string().required(),
      keterangan: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync({
      ...req.body,
      ...req.params,
    });

    const isExist = await database.kategoriSoalKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriSoalKecermatan.update({
      where: {
        id: validate.id,
      },
      data: {
        judul_kategori: validate.judul_kategori,
        keterangan: validate.keterangan,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data kategori kecermatan',
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

    const isExist = await database.kategoriSoalKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriSoalKecermatan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus kategori kecermatan',
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
