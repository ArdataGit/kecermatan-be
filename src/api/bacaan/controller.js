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
      kategoriSoalBacaanId: Joi.number().allow(null),
      includeSoal: Joi.boolean().default(false),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const where = {
      ...filterToJson(validate),
    };

    if (validate.kategoriSoalBacaanId) {
      where.kategoriSoalBacaanId = validate.kategoriSoalBacaanId;
    }

    const result = await database.$transaction([
      database.bacaan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: where,
        include: {
          kategoriSoalBacaan: true,
          soalBacaan: validate.includeSoal ? true : false,
        },
      }),
      database.bacaan.count({
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

    const result = await database.bacaan.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        kategoriSoalBacaan: true,
      },
    });

    if (!result) throw new BadRequestError('Bacaan tidak ditemukan');

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengambil detail bacaan',
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      kategoriSoalBacaanId: Joi.number().required(),
      bacaan: Joi.string().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const parentExist = await database.kategoriSoalBacaan.findUnique({
      where: { id: validate.kategoriSoalBacaanId },
    });
    if (!parentExist) throw new BadRequestError('Kategori bacaan tidak ditemukan');

    const result = await database.bacaan.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Bacaan',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      kategoriSoalBacaanId: Joi.number().allow(null),
      bacaan: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync({
      ...req.body,
      ...req.params,
    });

    const isExist = await database.bacaan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Bacaan tidak ditemukan');

    if (validate.kategoriSoalBacaanId) {
      const parentExist = await database.kategoriSoalBacaan.findUnique({
        where: { id: validate.kategoriSoalBacaanId },
      });
      if (!parentExist) throw new BadRequestError('Kategori bacaan tidak ditemukan');
    }

    const result = await database.bacaan.update({
      where: {
        id: validate.id,
      },
      data: {
        kategoriSoalBacaanId: validate.kategoriSoalBacaanId,
        bacaan: validate.bacaan,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data Bacaan',
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

    const isExist = await database.bacaan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Bacaan tidak ditemukan');

    const result = await database.bacaan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Bacaan',
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
