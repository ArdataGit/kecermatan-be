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
      database.kategoriSoalBacaan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...filterToJson(validate),
          ...(paketPembelianId && {
            paketPembelianBacaan: {
              some: {
                paketPembelianId: paketPembelianId,
              },
            },
          }),
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
    const take = validate.take ? validate.take : 10;
    const skip = validate.skip ? validate.skip : 0;

    let userIds = undefined;
    if (validate.search) {
        const users = await database.user.findMany({
            where: {
                name: { contains: validate.search },
            },
            select: { id: true }
        });
        userIds = users.map(u => u.id);
        if (userIds.length === 0) {
             return returnPagination(req, res, [[], 0]);
        }
    }

    const bacaanList = await database.bacaan.findMany({
        where: { kategoriSoalBacaanId: validate.kategoriSoalBacaanId },
        select: { id: true }
    });
    const bacaanIds = bacaanList.map(b => b.id);
    
    if (bacaanIds.length === 0) return returnPagination(req, res, [[], 0]);

    const whereClause = {
        bacaanId: { in: bacaanIds },
        ...(userIds && { userId: { in: userIds } })
    };

    const groupedHistory = await database.historyBacaan.groupBy({
        by: ['userId', 'bacaanHistoryId'],
        where: whereClause,
        _count: {
            soalBacaanId: true // Total questions attempted
        },
        _max: {
            createdAt: true
        },
        orderBy: {
            _max: {
                createdAt: 'desc'
            }
        },
        skip: skip,
        take: take,
    });
    
    const allGroups = await database.historyBacaan.groupBy({
        by: ['userId', 'bacaanHistoryId'],
        where: whereClause,
    });
    const totalCount = allGroups.length;

    const uniqueUserIdsInResult = [...new Set(groupedHistory.map(g => g.userId))];
    const usersInfo = await database.user.findMany({
        where: { id: { in: uniqueUserIdsInResult } },
        select: { id: true, name: true, email: true, gambar: true }
    });
    const usersMap = new Map(usersInfo.map(u => [u.id, u]));

    const transformedList = await Promise.all(groupedHistory.map(async (group) => {
        const user = usersMap.get(group.userId) || { id: group.userId, name: 'Unknown', email: '-', gambar: null };
        
        const score = await database.historyBacaan.count({
            where: {
                userId: group.userId,
                bacaanHistoryId: group.bacaanHistoryId,
                bacaanId: { in: bacaanIds },
                isCorrect: true
            }
        });
        
        const totalSoal = group._count.soalBacaanId;
        const totalBenar = score;
        const totalSalah = totalSoal - totalBenar;

        return {
            user: user,
            score: totalBenar,
            totalSoal: totalSoal,
            totalBenar: totalBenar,
            totalSalah: totalSalah,
            createdAt: group._max.createdAt,
            bacaanHistoryId: group.bacaanHistoryId,
            userId: group.userId 
        };
    }));

    return returnPagination(req, res, [transformedList, totalCount]);
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
      kategoriSoalBacaanId: Joi.number().required(),
      userId: Joi.number().required(),
      bacaanHistoryId: Joi.number().optional()
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    
    const where = {
        userId: validate.userId,
        bacaan: {
           kategoriSoalBacaanId: validate.kategoriSoalBacaanId
        }
    };
    
    if (validate.bacaanHistoryId) {
        where.bacaanHistoryId = validate.bacaanHistoryId;
    }

    const result = await database.historyBacaan.findMany({
      where: where,
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

    const uniqueHistoryMap = new Map();
    result.forEach(item => {
        if (!uniqueHistoryMap.has(item.soalBacaanId)) {
            uniqueHistoryMap.set(item.soalBacaanId, item);
        }
    });

    const uniqueHistory = Array.from(uniqueHistoryMap.values());
    
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

const getUserHistory = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      kategoriSoalBacaanId: Joi.number().required(),
      userId: Joi.number().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    
    // Use logged in user id if no userId param provided (for user-side access)
    const targetUserId = validate.userId || req.user?.id;
    const take = validate.take ? { take: validate.take } : {};
    const skip = validate.skip ? { skip: validate.skip } : {};

    const result = await database.historyBacaan.findMany({
      where: {
        userId: targetUserId,
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

    const uniqueHistoryMap = new Map();
    result.forEach(item => {
        if (!uniqueHistoryMap.has(item.soalBacaanId)) {
            uniqueHistoryMap.set(item.soalBacaanId, item);
        }
    });

    const uniqueHistory = Array.from(uniqueHistoryMap.values());

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
  getDetailHistory,
  getUserHistory,
};
