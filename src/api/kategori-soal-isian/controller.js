
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

    const whereClause = {
        kategoriSoalIsianId: validate.kategoriSoalIsianId,
        ...(userIds && { userId: { in: userIds } })
    };

    // Use groupBy to group by Session (User + SessionID)
    const groupedHistory = await database.historyIsian.groupBy({
        by: ['userId', 'isianHistoryId'],
        where: whereClause,
        _count: {
            soalIsianId: true
        },
        _sum: {
            score: true
        },
        _max: {
            createdAt: true
        },
        orderBy: {
            _max: {
                createdAt: 'desc'
            }
        },
        // Prisma groupBy supports skip/take for the groups
        skip: skip,
        take: take,
    });
    
    // Get total count of groups for pagination
    // We need a separate query for total groups count because groupBy with skip/take returns sliced data
    // Efficient way: distinct count? Prisma doesn't support count distinct on multiple columns easily.
    // We can fetch all groups (keys only) or use raw query.
    // Fallback: fetch valid groups without pagination (might be heavy if huge data)
    // Or just use the array length from a non-paginated call?
    // Let's try non-paginated call for count (or just fetch all if dataset is expected reasonable)
    // For scalability, raw query `SELECT COUNT(DISTINCT userId, isianHistoryId) ...` is better but let's stick to Prisma first.
    // We will do a second groupBy without skip/take just to get the length.
    
    // Optimization: if no search and no complex filtering, strict count might be harder.
    // Let's use `count` based on the grouping.
    const allGroups = await database.historyIsian.groupBy({
        by: ['userId', 'isianHistoryId'],
        where: whereClause,    
    });
    const totalCount = allGroups.length;

    // Fetch user details for the paginated results
    const uniqueUserIdsInResult = [...new Set(groupedHistory.map(g => g.userId))];
    const usersInfo = await database.user.findMany({
        where: { id: { in: uniqueUserIdsInResult } },
        select: { id: true, name: true, email: true, gambar: true }
    });
    
    const usersMap = new Map(usersInfo.map(u => [u.id, u]));

    const transformedList = groupedHistory.map(group => {
        const user = usersMap.get(group.userId) || { id: group.userId, name: 'Unknown', email: '-', gambar: null };
        return {
            user: user,
            totalSoal: group._count.soalIsianId,
            totalScore: group._sum.score || 0,
            createdAt: group._max.createdAt,
            // Pass session ID (isianHistoryId) if needed for detail view link?
            // The frontend detail link probably needs to know WHICH session to show.
            // But standard detail route `/manage-soal-isian/:id/history/:userId` uses `userId`.
            // Does it support session ID filtering? 
            // Step Id 1635: detail controller `getDetailHistory` filters by `userId` and `kategoriId`.
            // It gets ALL history for that user.
            // If we want to show specific session detail, we need to pass `isianHistoryId` to detail page/controller.
            // For now, let's just return it.
            isianHistoryId: group.isianHistoryId
        };
    });

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
      kategoriSoalIsianId: Joi.number().required(),
      userId: Joi.number().required(),
      isianHistoryId: Joi.number().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const start = validate.skip || 0;
    // const end = start + (validate.take || 100);

    const queryOptions = {
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
    };

    if (validate.isianHistoryId) {
        queryOptions.where.isianHistoryId = validate.isianHistoryId;
    }

    const result = await database.historyIsian.findMany(queryOptions);
    
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

const ranking = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      kategoriSoalIsianId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    
    // Raw query to get ranking based on LATEST session (isianHistoryId) per user
    // 1. Group by userId + isianHistoryId to get session stats (total score, time)
    // 2. Rank sessions per user by createdAt desc (ROW_NUMBER)
    // 3. Select only the latest session (rn = 1)
    // 4. Order by totalScore desc
    
    const result = [];
    
    const query = await database.$queryRaw`
        WITH SessionStats AS (
            SELECT
                h.userId,
                h.isianHistoryId,
                SUM(h.score) as totalScore,
                MAX(h.createdAt) as createdAt,
                h.kategoriSoalIsianId
            FROM historyIsian h
            WHERE h.kategoriSoalIsianId = ${validate.kategoriSoalIsianId}
            GROUP BY h.userId, h.isianHistoryId, h.kategoriSoalIsianId
        ),
        UserLatestSession AS (
            SELECT
                s.*,
                ROW_NUMBER() OVER (PARTITION BY s.userId ORDER BY s.createdAt DESC) as rn
            FROM SessionStats s
        )
        SELECT
            uls.userId,
            uls.totalScore,
            uls.createdAt,
            uls.isianHistoryId,
            u.name,
            u.gambar
        FROM UserLatestSession uls
        LEFT JOIN User u ON uls.userId = u.id
        WHERE uls.rn = 1
        ORDER BY uls.totalScore DESC
        LIMIT ${validate.take || 10}
        OFFSET ${validate.skip || 0}
    `;
    
    // Map BigInt to number if needed (Prisma returns BigInt for sums sometimes depending on driver, but SUM(int) usually int)
    // Actually Prisma raw query returns dictionaries.
    
    result[0] = query;
    
    // Count total users
    const countQuery = await database.$queryRaw`
         SELECT COUNT(DISTINCT userId) as total
         FROM historyIsian
         WHERE kategoriSoalIsianId = ${validate.kategoriSoalIsianId}
    `;
    
    // BigInt handling for count
    const total = Number(countQuery[0]?.total || 0);
    result[1] = total;

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
  getDetailHistory,
  getUserHistory,
  updateScore,
  ranking
};
