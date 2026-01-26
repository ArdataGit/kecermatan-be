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
      database.kategoriSoalBacaan.findMany({
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
              bacaan: true,
            },
          },
        },
      }),
      database.kategoriSoalBacaan.count({
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

    const result = await database.kategoriSoalBacaan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!result) throw new BadRequestError('Kategori tidak ditemukan');

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengambil detail kategori bacaan',
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
    });

    const validate = await schema.validateAsync(req.body);

    const result = await database.kategoriSoalBacaan.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Kategori Bacaan',
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

    const isExist = await database.kategoriSoalBacaan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriSoalBacaan.update({
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
      msg: 'Berhasil mengubah data kategori bacaan',
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

    const isExist = await database.kategoriSoalBacaan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriSoalBacaan.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus kategori bacaan',
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
      kategoriSoalBacaanId: Joi.number().required(),
      search: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};
    const skip = validate.skip ? { skip: validate.skip } : {};

    const whereClause = {
      historyBacaan: {
        some: {
          bacaan: {
            kategoriSoalBacaanId: validate.kategoriSoalBacaanId
          }
        }
      }
    };

    if (validate.search) {
        whereClause.name = {
            contains: validate.search,
        };
    }

    const result = await database.$transaction([
      database.user.findMany({
        ...take,
        ...skip,
        where: whereClause,
        select: {
            id: true,
            name: true,
            email: true,
            gambar: true,
            historyBacaan: {
                where: {
                    bacaan: {
                        kategoriSoalBacaanId: validate.kategoriSoalBacaanId
                    }
                },
                select: {
                    isCorrect: true,
                    createdAt: true
                }
            }
        },
        orderBy: {
            // For now, sorting by user info is easiest. 
            // Sorting by aggregated score would require raw query or post-processing (which breaks pagination).
            // Let's stick to default sorting or name for now, or createdAt descending.
            updatedAt: 'desc' 
        },
      }),
      database.user.count({
        where: whereClause,
      }),
    ]);

    // Transform result to match desired format
    const transformedList = result[0].map(user => {
        const history = user.historyBacaan || [];
        const totalSoal = history.length;
        const totalBenar = history.filter(h => h.isCorrect).length;
        const totalSalah = totalSoal - totalBenar;
        const score = totalBenar; // Assuming 1 point per correct answer for now

        // Find latest submission time
        const latestInfo = history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
        const createdAt = latestInfo ? latestInfo.createdAt : null;

        return {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                gambar: user.gambar
            },
            score,
            totalSoal,
            totalBenar,
            totalSalah,
            createdAt
        };
    });

    // If sorting by score was requested, we might need to do it here for the current page, 
    // but global sorting isn't possible this way. 
    // Given the constraints, we'll return the page as is.
    if(validate.sortBy === 'score') {
        transformedList.sort((a, b) => validate.descending ? b.score - a.score : a.score - b.score);
    }

    return returnPagination(req, res, [transformedList, result[1]]);
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
      kategoriSoalBacaanId: Joi.number().required(),
      userId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};
    const skip = validate.skip ? { skip: validate.skip } : {};

    const result = await database.historyBacaan.findMany({
      where: {
        userId: validate.userId,
        bacaan: {
           kategoriSoalBacaanId: validate.kategoriSoalBacaanId
        }
      },
      include: {
        user: {
          select: {
            name: true,
            gambar: true,
          },
        },
        bacaan: true,
        soalBacaan: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Deduplicate: Keep only the latest attempt for each soalBacaanId
    const uniqueHistoryMap = new Map();
    result.forEach(item => {
        if (!uniqueHistoryMap.has(item.soalBacaanId)) {
            uniqueHistoryMap.set(item.soalBacaanId, item);
        }
    });

    const uniqueHistory = Array.from(uniqueHistoryMap.values());

    // Apply pagination manually if needed, or just return all (since it's a detail view usually showing all questions)
    // The frontend sends take: 100, which is likely enough for "all unique questions" if the exam isn't huge.
    // If we want to strictly follow skip/take:
    const start = validate.skip || 0;
    const end = start + (validate.take || uniqueHistory.length);
    const paginatedResult = uniqueHistory.slice(start, end);

    return res.status(200).json({
        data: {
            list: paginatedResult,
            pagination: {
                total: uniqueHistory.length.toString(),
                skip: Number(validate.skip || 0),
                take: Number(validate.take || 0),
                currentTotal: paginatedResult.length
            }
        },
        msg: 'Berhasil mengambil detail history user'
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
  getHistory,
  getUserHistory,
};
