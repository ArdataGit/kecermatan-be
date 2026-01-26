
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
      paketPembelianId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};

    const where = {
       paketPembelianId: validate.paketPembelianId
    };

    const result = await database.$transaction([
      database.paketPembelianIsian.findMany({
        ...take,
        skip: validate.skip,
        where: where,
        include: {
            kategoriSoalIsian: {
                include: {
                    _count: {
                        select: {
                            soalIsian: true
                        }
                    }
                }
            }
        },
        orderBy: {
            createdAt: 'desc'
        }
      }),
      database.paketPembelianIsian.count({ where: where })
    ]);

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      paketPembelianId: Joi.number().required(),
      kategoriSoalIsianId: Joi.number().required(),
      type: Joi.string().optional(),
    });

    const validate = await schema.validateAsync(req.body);

    const isExist = await database.paketPembelianIsian.findFirst({
        where: {
            paketPembelianId: validate.paketPembelianId,
            kategoriSoalIsianId: validate.kategoriSoalIsianId
        }
    });

    if (isExist) throw new BadRequestError('Kategori Isian sudah ada dalam paket ini');

    const result = await database.paketPembelianIsian.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Kategori Isian ke Paket',
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

    const isExist = await database.paketPembelianIsian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Data tidak ditemukan');

    const result = await database.paketPembelianIsian.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Kategori Isian dari Paket',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  get,
  insert,
  remove,
};
