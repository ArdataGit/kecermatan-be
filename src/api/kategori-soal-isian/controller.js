
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
      filters: Joi.object({
        paketPembelianId: Joi.number().optional(),
      }).unknown(true),
      paketPembelianId: Joi.number().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);

    // Extract paketPembelianId filter, do NOT put it in validate.filters to avoid filterToJson processing it
    const paketPembelianId = validate.filters?.paketPembelianId || validate.paketPembelianId;
    if (validate.filters?.paketPembelianId) {
        delete validate.filters.paketPembelianId;
    }

    const take = validate.take ? { take: validate.take } : {};

    const result = await database.$transaction([
      database.kategoriSoalIsian.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
          ...(paketPembelianId && {
            paketPembelianIsian: {
              some: {
                paketPembelianId: paketPembelianId,
              },
            },
          }),
        },
        include: {
          _count: {
            select: {
              soalIsian: true,
            },
          },
        },
      }),
      database.kategoriSoalIsian.count({
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

    const result = await database.kategoriSoalIsian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!result) throw new BadRequestError('Kategori tidak ditemukan');

    res.status(200).json({
      data: result,
      msg: 'Berhasil mengambil detail kategori isian',
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

    const result = await database.kategoriSoalIsian.create({
      data: validate,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Kategori Isian',
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

    const isExist = await database.kategoriSoalIsian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriSoalIsian.update({
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
      msg: 'Berhasil mengubah data kategori isian',
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

    const isExist = await database.kategoriSoalIsian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kategori tidak ditemukan');

    const result = await database.kategoriSoalIsian.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menghapus kategori isian',
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
      kategoriSoalIsianId: Joi.number().required(),
      search: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};
    const skip = validate.skip ? { skip: validate.skip } : {};

    const whereClause = {
      historyIsian: {
        some: {
          kategoriSoalIsianId: validate.kategoriSoalIsianId
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
            historyIsian: {
                where: {
                    kategoriSoalIsianId: validate.kategoriSoalIsianId
                },
                    select: {
                        createdAt: true,
                        score: true
                    }
            }
        },
        orderBy: {
            updatedAt: 'desc' 
        },
      }),
      database.user.count({
        where: whereClause,
      }),
    ]);

    // Transform result
    const transformedList = result[0].map(user => {
        const history = user.historyIsian || [];
        const totalSoal = history.length;
        const totalScore = history.reduce((acc, curr) => acc + (curr.score || 0), 0);
        
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
            totalSoal,
            totalScore,
            createdAt
        };
    });

    return returnPagination(req, res, [transformedList, result[1]]);
  } catch (error) {
    next(error);
  }
};

const getDetailHistory = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      kategoriSoalIsianId: Joi.number().required(),
      userId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const start = validate.skip || 0;
    // const end = start + (validate.take || 100);

    const result = await database.historyIsian.findMany({
      where: {
        userId: validate.userId,
        kategoriSoalIsianId: validate.kategoriSoalIsianId
      },
      include: {
        user: {
          select: {
            name: true,
            gambar: true,
          },
        },
        soalIsian: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    // Deduplicate logic if needed (though historyIsian logic handles duplicates via upsert in other places, 
    // my insert logic earlier was a check-then-update/create, so duplicates shouldn't exist ideally)
    const uniqueHistoryMap = new Map();
    result.forEach(item => {
        if (!uniqueHistoryMap.has(item.soalIsianId)) {
            uniqueHistoryMap.set(item.soalIsianId, item);
        }
    });

    const uniqueHistory = Array.from(uniqueHistoryMap.values());
    // Pagination slicing if needed
    
    return res.status(200).json({
        data: {
            list: uniqueHistory, // returning all for detail view usually
            pagination: {
                total: uniqueHistory.length.toString(),
                skip: Number(validate.skip || 0),
                take: Number(validate.take || 0),
                currentTotal: uniqueHistory.length
            }
        },
        msg: 'Berhasil mengambil detail history user isian'
    });
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
      kategoriSoalIsianId: Joi.number().required(),
      userId: Joi.number().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const targetUserId = validate.userId || req.user?.id;
    
    const result = await database.historyIsian.findMany({
      where: {
        userId: targetUserId,
        kategoriSoalIsianId: validate.kategoriSoalIsianId
      },
      include: {
        user: {
          select: {
            name: true,
            gambar: true,
          },
        },
        soalIsian: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    const uniqueHistoryMap = new Map();
    result.forEach(item => {
        if (!uniqueHistoryMap.has(item.soalIsianId)) {
            uniqueHistoryMap.set(item.soalIsianId, item);
        }
    });

    const uniqueHistory = Array.from(uniqueHistoryMap.values());
    
    return res.status(200).json({
        data: {
            list: uniqueHistory,
            pagination: {
                total: uniqueHistory.length.toString(),
                skip: Number(validate.skip || 0),
                take: Number(validate.take || 0),
                currentTotal: uniqueHistory.length
            }
        },
        msg: 'Berhasil mengambil history user isian'
    });
  } catch (error) {
    next(error);
  }
};

const updateScore = async (req, res, next) => {
  try {
    const schema = Joi.object({
      historyId: Joi.number().required(),
      score: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const isExist = await database.historyIsian.findUnique({
        where: { id: validate.historyId }
    });

    if (!isExist) throw new BadRequestError('History tidak ditemukan');

    const result = await database.historyIsian.update({
        where: { id: validate.historyId },
        data: { score: validate.score }
    });

    res.status(200).json({
        data: result,
        msg: 'Berhasil mengupdate nilai'
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
  getDetailHistory,
  getUserHistory,
  updateScore
};
