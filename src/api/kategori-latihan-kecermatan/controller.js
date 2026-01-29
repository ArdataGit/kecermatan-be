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
      database.kategoriLatihanKecermatan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
        },
        include: {
          user: {
            select: {
              name: true,
            },
          },
          _count: {
            select: {
              latihanKiasan: true,
            },
          },
        },
      }),
      database.kategoriLatihanKecermatan.count({
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

    const result = await database.kategoriLatihanKecermatan.findUnique({
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

    const result = await database.kategoriLatihanKecermatan.create({
      data: {
        ...validate,
        userId: req.user.id,
      },
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

    const isExist = await database.kategoriLatihanKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriLatihanKecermatan.update({
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

    const isExist = await database.kategoriLatihanKecermatan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriLatihanKecermatan.delete({
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

const getHistory = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      kategoriLatihanKecermatanId: Joi.number().required(),
      search: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take || 10;
    const skip = validate.skip || 0;

    // Fetch distinct users who have history for this category
    // Since Prisma groupBy usually doesn't support relation fetching, we might do this in 2 steps
    // Or just fetch many history items and aggregated in JS (if data is small)
    // or use Raw Query.
    // Let's use groupBy first to get Users
    
    // 1. Get Distinct Users
    const distinctUsers = await database.latihanKecermatanHistory.groupBy({
        by: ['userId'],
        where: {
            kategoriLatihanKecermatanId: Number(validate.kategoriLatihanKecermatanId)
        },
        _count: {
            id: true
        },
        _max: {
            createdAt: true // Last attempt time
        },
        // Pagination logic for groups is tricky in Prisma.
        // We might just fetch all users (assuming not millions) and slice in JS
        // Or simple slice
        take: take,
        skip: skip,
        orderBy: {
            _max: {
                createdAt: validate.descending ? 'desc' : 'asc'
            }
        }
    });

    const totalUsers = await database.latihanKecermatanHistory.groupBy({
        by: ['userId'],
        where: {
            kategoriLatihanKecermatanId: Number(validate.kategoriLatihanKecermatanId)
        }, 
    });

    // 2. Enrich with User Details and Stats
    const enrichedData = await Promise.all(distinctUsers.map(async (group) => {
        const user = await database.user.findUnique({
            where: { id: group.userId },
            select: { id: true, name: true, email: true, gambar: true }
        });

        // Calculate Stats for this user in this category
        // Note: This sums ALL history for this user/category.
        // If we want per-session, we need session ID. For now, total stats.
        
        const stats = await database.$transaction([
             database.latihanKecermatanHistory.count({
                 where: {
                     userId: group.userId,
                     kategoriLatihanKecermatanId: Number(validate.kategoriLatihanKecermatanId)
                 }
             }),
             database.latihanKecermatanHistory.count({
                where: {
                    userId: group.userId,
                    kategoriLatihanKecermatanId: Number(validate.kategoriLatihanKecermatanId),
                    // We need to join to check correctness: jawaban == soal.jawaban
                    // Prisma count doesn't support complex relation comparison directly without raw query or iterating.
                    // THIS IS TRICKY. 
                    // Simple workaround: 'correct' logic is usually stored.
                    // Since I didn't store isCorrect boolean, I have to check it.
                    // Doing it in JS.
                }
            })
        ]);
        
        // Fetch ALL answer for this user/category to count correct/wrong
        const allAnswers = await database.latihanKecermatanHistory.findMany({
            where: {
                userId: group.userId,
                kategoriLatihanKecermatanId: Number(validate.kategoriLatihanKecermatanId)
            },
            include: {
                soalLatihanKecermatan: { select: { jawaban: true } }
            }
        });

        let correct = 0;
        let wrong = 0;
        allAnswers.forEach(ans => {
            if(ans.jawaban === ans.soalLatihanKecermatan?.jawaban) correct++;
            else wrong++;
        });

        return {
            userId: group.userId,
            user: user,
            totalSoal: allAnswers.length,
            totalBenar: correct,
            totalSalah: wrong,
            lastAttempt: group._max.createdAt
        };
    }));

    // Mock return structure for useGetList
    const result = {
        list: enrichedData,
        total: totalUsers.length // Distinct user count
    };

    return returnPagination(req, res, [result.list, result.total]);
  } catch (error) {
    next(error);
  }
};

const getUserHistory = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      kategoriLatihanKecermatanId: Joi.number().required(),
      userId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};
    const skip = validate.skip ? { skip: validate.skip } : {};

    const result = await database.$transaction([
      database.latihanKecermatanHistory.findMany({
        ...take,
        ...skip,
        where: {
          userId: Number(validate.userId),
          kategoriLatihanKecermatanId: Number(validate.kategoriLatihanKecermatanId),
        },
        include: {
          user: {
            select: {
              name: true,
              gambar: true,
            },
          },
          latihanKiasan: true,
          soalLatihanKecermatan: true,
        },
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
      }),
      database.latihanKecermatanHistory.count({
        where: {
            userId: Number(validate.userId),
            kategoriLatihanKecermatanId: Number(validate.kategoriLatihanKecermatanId),
        },
      }),
    ]);

    return returnPagination(req, res, result);
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
  getHistory,
  getUserHistory,
};
