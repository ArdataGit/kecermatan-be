const Joi = require('joi');
const database = require('#database');
const { returnPagination, filterToJson } = require('#utils');
const { BadRequestError } = require('#errors');

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      soalBacaanId: Joi.number().required(),
      jawaban: Joi.string().required(),
      bacaanId: Joi.number().required(),
      kategoriSoalBacaanId: Joi.number().optional(),
      bacaanHistoryId: Joi.number().optional(),
    });

    const validate = await schema.validateAsync(req.body);
    const userId = req.user.id;

    // Validate Soal and Get Correct Answer
    const soal = await database.soalBacaan.findUnique({
      where: { id: validate.soalBacaanId },
    });

    if (!soal) throw new BadRequestError('Soal tidak ditemukan');

    const isCorrect = soal.jawaban === validate.jawaban;

    const result = await database.historyBacaan.create({
      data: {
        userId: userId,
        bacaanId: validate.bacaanId,
        soalBacaanId: validate.soalBacaanId,
        jawaban: validate.jawaban,
        isCorrect: isCorrect,
        bacaanHistoryId: validate.bacaanHistoryId,
      },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menyimpan jawaban',
    });
  } catch (error) {
    next(error);
  }
};

const getMyHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      bacaanId: Joi.number().optional(),
      bacaanHistoryId: Joi.number().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};

    const where = {
      userId: userId,
      ...filterToJson(validate),
    };
    
    if (validate.bacaanId) where.bacaanId = validate.bacaanId;
    if (validate.bacaanHistoryId) where.bacaanHistoryId = validate.bacaanHistoryId;

    const result = await database.$transaction([
        database.historyBacaan.findMany({
            ...take,
            skip: validate.skip,
            where: where,
            include: {
                soalBacaan: true
            },
            orderBy: { createdAt: 'desc' }
        }),
        database.historyBacaan.count({ where: where })
    ]);

    return returnPagination(req, res, result);

  } catch (error) {
    next(error);
  }
}

const generateSessionId = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const maxId = await database.historyBacaan.aggregate({
            _max: {
                bacaanHistoryId: true
            },
            where: {
                userId: userId
            }
        });
        
        const newId = (maxId._max.bacaanHistoryId || 0) + 1;
        
        res.status(200).json({
            data: newId,
            msg: 'Berhasil generate session ID baru'
        });
    } catch (error) {
        next(error);
    }
};

const getMySessionList = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      kategoriSoalBacaanId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? validate.take : 10;
    const skip = validate.skip ? validate.skip : 0;
    
    // historyBacaan doesn't have kategoriSoalBacaanId directly.
    // We need to filter by bacaan that belongs to this category.
    const bacaanList = await database.bacaan.findMany({
        where: { kategoriSoalBacaanId: validate.kategoriSoalBacaanId },
        select: { id: true }
    });
    const bacaanIds = bacaanList.map(b => b.id);

    if (bacaanIds.length === 0) return returnPagination(req, res, [[], 0]);

    const whereClause = {
        userId: userId,
        bacaanId: { in: bacaanIds },
    };

    // Use raw query or groupBy.
    // GroupBy is easier if we just need stats.
    // But we need to calculate SCORE (isCorrect counts).
    
    // Use raw query or groupBy.
    // GroupBy is easier if we just need stats.
    
    // Need Prisma.join to pass array to IN clause in raw query, or use findMany/groupBy if possible.
    // Wait, requiring Prisma object inside controller might be tricky if not imported.
    // database is imported. Is Prisma imported? Usually `const { Prisma } = require('@prisma/client')` or similar.
    // Check imports. `const database = require('#database');`
    // I don't see Prisma imported.
    // Safe bet: use Prisma's groupBy + distinct/manual aggregation?
    // OR: use groupBy on `bacaanHistoryId`.
    // It returns `_count` but not conditional `_count`.
    // We can fetch data andaggregate manually? No, pagination.
    
    // Let's use `groupBy` and just count items.
    // For score: we can't get it easily.
    // Isian `historyIsian` has `score` column.
    // Bacaan `historyBacaan` has `isCorrect`.
    
    // Optimization: Add `score` column to `historyBacaan`? (1 or 0)
    // Or just accept that we need to fetch items to calc score.
    // Or use raw query without `Prisma.join`. Just mapped string? Dangerous for injection?
    // IDs are integers from DB, reasonably safe.
    
    // Let's use `groupBy` to get sessions. Then for each session, query the score?
    // N+1 problem.
    // But pagination is small (10 items). `Promise.all` 10 queries is fine.
    
    const sessions = await database.historyBacaan.groupBy({
        by: ['bacaanHistoryId'],
        where: whereClause,
        _count: {
            id: true // Total questions attempted
        },
        _max: {
            createdAt: true
        },
        orderBy: {
            _max: { createdAt: 'desc' }
        },
        take: take,
        skip: skip
    });
    
    // Calculate totals (count distinct sessions)
    const allGroups = await database.historyBacaan.groupBy({
        by: ['bacaanHistoryId'],
        where: whereClause,
    });
    const totalCount = allGroups.length;

    // Enhance with Score
    const enhancedSessions = await Promise.all(sessions.map(async (s) => {
        const scoreCount = await database.historyBacaan.count({
            where: {
                userId: userId,
                bacaanHistoryId: s.bacaanHistoryId,
                bacaanId: { in: bacaanIds },
                isCorrect: true
            }
        });
        return {
            bacaanHistoryId: s.bacaanHistoryId,
            createdAt: s._max.createdAt,
            totalSoal: s._count.id,
            totalScore: scoreCount
        };
    }));

    return returnPagination(req, res, [enhancedSessions, totalCount]);

  } catch (error) {
    next(error);
  }
};

module.exports = {
  insert,
  getMyHistory,
  generateSessionId,
  getMySessionList
};
