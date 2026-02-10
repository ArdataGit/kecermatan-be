const Joi = require('joi');
const database = require('#database');
const {
  returnPagination,
  filterToJson,
} = require('#utils');
const { BadRequestError } = require('#errors');

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
      paketPembelianId: Joi.number(),
    });

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};

    const result = await database.$transaction([
      database.paketPembelianKecermatan.findMany({
        ...take,
        skip: validate.skip,
        include: {
          kategoriSoalKecermatan: {
            include: {
              Kiasan: true,
            }
          },
        },
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: {
          paketPembelianId: validate.paketPembelianId,
          ...filterToJson(validate),
        },
      }),
      database.paketPembelianKecermatan.count({
        where: {
          paketPembelianId: validate.paketPembelianId,
          ...filterToJson(validate),
        },
      }),
    ]);

    const mappedResult = result[0].map((item) => {
        let totalWaktu = 0;
        if (item.kategoriSoalKecermatan && item.kategoriSoalKecermatan.Kiasan) {
             totalWaktu = item.kategoriSoalKecermatan.Kiasan.reduce((acc, kiasan) => {
                 return acc + (kiasan.waktu || 0);
             }, 0);
        }
        if (item.kategoriSoalKecermatan) {
            item.kategoriSoalKecermatan.waktu = totalWaktu;
             // Optional: remove heavy nested data to keep payload small
            delete item.kategoriSoalKecermatan.Kiasan;
        }
        return item;
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

    const result = await database.paketPembelianKecermatan.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        kategoriSoalKecermatan: true,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mendapatkan detail paket kecermatan',
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      paketPembelianId: Joi.number().required(),
      kategoriSoalKecermatanId: Joi.number().required(),
      type: Joi.string()
        .valid('KECERMATAN', 'TRYOUT', 'PENDAHULUAN', 'PEMANTAPAN')
        .required(),
    });

    const validate = await schema.validateAsync(req.body);

    const result = await database.paketPembelianKecermatan.create({
      data: {
        paketPembelianId: validate.paketPembelianId,
        kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,// Map to correct FK
        type: validate.type,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Paket Kecermatan',
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      paketPembelianId: Joi.number().required(),
      kategoriSoalKecermatanId: Joi.number().required(),
      type: Joi.string()
        .valid('KECERMATAN', 'TRYOUT', 'PENDAHULUAN', 'PEMANTAPAN')
        .required(),
    });

    const validate = await schema.validateAsync(
      {
        ...req.body,
        ...req.params,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.paketPembelianKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Data tidak ditemukan');

    const result = await database.paketPembelianKecermatan.update({
      where: {
        id: validate.id,
      },
      data: {
        paketPembelianId: validate.paketPembelianId,
        kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
        type: validate.type,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengubah Paket Kecermatan',
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

    const isExist = await database.paketPembelianKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Data tidak ditemukan');

    const result = await database.paketPembelianKecermatan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus Paket Kecermatan',
    });
  } catch (error) {
    next(error);
  }
};

// Placeholder for functions that were specific to Tryout logic and might need custom implementation for Kecermatan later
const getHistory = async (req, res, next) => {
    try {
        const schema = Joi.object({
            skip: Joi.number(),
            take: Joi.number(),
            sortBy: Joi.string(),
            descending: Joi.boolean(),
            kategoriSoalKecermatanId: Joi.number().required(),
        }).unknown(true);

        const validate = await schema.validateAsync(req.query);
        const take = validate.take ? { take: validate.take } : {};
        const skip = validate.skip ? { skip: validate.skip } : {};

        const result = await database.$transaction([
            database.kecermatanHistory.findMany({
                ...take,
                ...skip,
                where: {
                    userId: req.user.id,
                    kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
                },
                include: {
                    user: {
                        select: {
                            name: true,
                            gambar: true,
                        },
                    },
                    kiasan: true,
                    soalKecermatan: true,
                },
                orderBy: {
                    [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
                },
            }),
            database.kecermatanHistory.count({
                where: {
                    userId: req.user.id,
                    kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
                },
            }),
        ]);

        return returnPagination(req, res, result);
    } catch (error) {
        next(error);
    }
};

const getMyHistoryList = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const schema = Joi.object({
            skip: Joi.number(),
            take: Joi.number(),
            sortBy: Joi.string(),
            descending: Joi.boolean(),
            kategoriSoalKecermatanId: Joi.number().required(),
        }).unknown(true);

        const validate = await schema.validateAsync(req.query);
        const take = validate.take ? { take: validate.take } : {};
        const skip = validate.skip ? { skip: validate.skip } : {};

        const whereClause = {
            userId: userId,
            kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
        };

        const result = await database.$transaction([
            database.kecermatanRanking.findMany({
                ...take,
                ...skip,
                where: whereClause,
                orderBy: {
                    [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
                },
            }),
            database.kecermatanRanking.count({
                where: whereClause,
            }),
        ]);

        return returnPagination(req, res, result);
    } catch (error) {
        next(error);
    }
};

const excel = async (req, res, next) => {
    res.status(501).json({ msg: "Not implemented for Kecermatan yet" });
};

const excelTryout = async (req, res, next) => {
    res.status(501).json({ msg: "Not implemented for Kecermatan yet" });
};

const getRanking = async (req, res, next) => {
    try {
        const schema = Joi.object({
            skip: Joi.number(),
            take: Joi.number(),
            sortBy: Joi.string(),
            descending: Joi.boolean(),
            kategoriSoalKecermatanId: Joi.number().required(),
        }).unknown(true);

        const validate = await schema.validateAsync(req.query);
        const take = validate.take ? { take: validate.take } : {};
        const skip = validate.skip ? { skip: validate.skip } : {};

        const result = await database.$transaction([
            database.kecermatanRanking.findMany({
                ...take,
                ...skip,
                where: {
                    kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
                },
                distinct: ['userId'],
                include: {
                    user: {
                        select: {
                            name: true,
                            gambar: true,
                        },
                    },
                },
                orderBy: [
                    { score: 'desc' },
                    { createdAt: 'asc' }
                ],
            }),
            database.kecermatanRanking.groupBy({
                by: ['userId'],
                where: {
                    kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
                },
            }),
        ]);

        return returnPagination(req, res, [result[0], result[1].length]);
    } catch (error) {
        next(error);
    }
};

const insertRanking = async (req, res, next) => {
    try {

        const schema = Joi.object({
            kategoriSoalKecermatanId: Joi.number().required(),
            userId: Joi.number().required(),
            score: Joi.number().required(),
            totalSoal: Joi.number().required(),
            totalSalah: Joi.number().required(),
            totalBenar: Joi.number().required(),
            pankerScore: Joi.number().optional(),
            pankerCategory: Joi.string().optional(),
            tiankerScore: Joi.number().optional(),
            tiankerCategory: Joi.string().optional(),
            jankerScore: Joi.number().optional(),
            jankerCategory: Joi.string().optional(),
            hankerScore: Joi.number().optional(),
            hankerCategory: Joi.string().optional(),
            finalScore: Joi.number().optional(),
            finalCategory: Joi.string().optional(),
        })

        const validate = await schema.validateAsync(req.body);

        const result = await database.kecermatanRanking.create({
            data: {
                kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
                userId: validate.userId,
                score: validate.score,
                totalSoal: validate.totalSoal,
                totalSalah: validate.totalSalah,
                totalBenar: validate.totalBenar,
                waktu: 0, // Default value as it's required in schema but not in Joi
                pankerScore: validate.pankerScore || 0,
                pankerCategory: validate.pankerCategory,
                tiankerScore: validate.tiankerScore || 0,
                tiankerCategory: validate.tiankerCategory,
                jankerScore: validate.jankerScore || 0,
                jankerCategory: validate.jankerCategory,
                hankerScore: validate.hankerScore || 0,
                hankerCategory: validate.hankerCategory,
                finalScore: validate.finalScore || 0,
                finalCategory: validate.finalCategory,
            },
        });

        res.status(200).json({
            data: result,
            msg: 'Berhasil menambahkan Ranking Kecermatan',
        });
    } catch (error) {
      console.log(error);
        next(error);
    }
};

const insertHistory = async (req, res, next) => {
    try {

        const schema = Joi.object({
            kategoriSoalKecermatanId: Joi.number().required(),
            userId: Joi.number().required(),
            soalKecermatanId: Joi.number().required(),
            kiasanId: Joi.number().required(),
            jawaban: Joi.string().required(),
        })  

        const validate = await schema.validateAsync(req.body);

        const result = await database.kecermatanHistory.create({
            data: {
                kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
                userId: validate.userId,
                soalKecermatanId: validate.soalKecermatanId,
                kiasanId: validate.kiasanId,
                jawaban: validate.jawaban,
            },
        });

        res.status(200).json({
            data: result,
            msg: 'Berhasil menambahkan History Kecermatan',
        });
    } catch (error) {
      console.log(error);
        next(error);
    }
};

module.exports = {
  get,
  insert,
  update,
  remove,
  find,
  getHistory,
  getMyHistoryList,
  excel,
  excelTryout,
  insertRanking,
  getRanking,
  insertHistory,
};
