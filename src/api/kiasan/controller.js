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
      kategoriSoalKecermatanId: Joi.number().allow(null),
      includeSoal: Joi.boolean(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const where = {
      ...filterToJson(validate),
    };

    if (validate.kategoriSoalKecermatanId) {
      where.kategoriSoalKecermatanId = validate.kategoriSoalKecermatanId;
    }

    const result = await database.$transaction([
      database.kiasan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: where,
        include: {
          kategoriSoalKecermatan: true,
          SoalKecermatan: validate.includeSoal ? true : false,
          _count: {
            select: {
              SoalKecermatan: true,
            },
          },
        },
      }),
      database.kiasan.count({
        where: where,
      }),
    ]);

    const mappedResult = result[0].map((item) => {
      return {
        ...item,
        total_waktu: item.waktu,
      };
    });

    return returnPagination(req, res, [mappedResult, result[1]]);
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

    const result = await database.kiasan.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        kategoriSoalKecermatan: true,
        SoalKecermatan: true,
      },
    });

    if (!result) throw new BadRequestError('Kiasan tidak ditemukan');

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
      kategoriSoalKecermatanId: Joi.number().required(),
      karakter: Joi.array().required(), // Validate as array
      kiasan: Joi.array().required(),   // Validate as array
      waktu: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.body);

    // Verify parent exists
    const parentExist = await database.kategoriSoalKecermatan.findUnique({
      where: { id: validate.kategoriSoalKecermatanId },
    });
    if (!parentExist) throw new BadRequestError('Kategori Soal Kecermatan tidak ditemukan');

    const result = await database.kiasan.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Kiasan',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      kategoriSoalKecermatanId: Joi.number().allow(null),
      karakter: Joi.array().allow(null),
      kiasan: Joi.array().allow(null),
      waktu: Joi.number().allow(null),
    }).unknown(true);

    const validate = await schema.validateAsync({
      ...req.body,
      ...req.params,
    });

    const isExist = await database.kiasan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kiasan tidak ditemukan');

    if (validate.kategoriSoalKecermatanId) {
       const parentExist = await database.kategoriSoalKecermatan.findUnique({
        where: { id: validate.kategoriSoalKecermatanId },
      });
      if (!parentExist) throw new BadRequestError('Kategori Soal Kecermatan tidak ditemukan');
    }

    const result = await database.kiasan.update({
      where: {
        id: validate.id,
      },
      data: {
        kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
        karakter: validate.karakter,
        kiasan: validate.kiasan,
        waktu: validate.waktu,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah data Kiasan',
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

    const isExist = await database.kiasan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kiasan tidak ditemukan');

    const result = await database.kiasan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Kiasan',
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
