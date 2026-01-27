
const Joi = require('joi');
const database = require('#database');
const { returnPagination, filterToJson } = require('#utils');
const { BadRequestError } = require('#errors');

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      soalIsianId: Joi.number().required(),
      jawaban: Joi.string().required(),
      kategoriSoalIsianId: Joi.number().required(),
      isianHistoryId: Joi.number().optional(),
    });

    const validate = await schema.validateAsync(req.body);
    const userId = req.user.id;

    // Check if history already exists for this user and question
    // Always create new history entry as requested
    const result = await database.historyIsian.create({
        data: {
            userId: userId,
            kategoriSoalIsianId: validate.kategoriSoalIsianId,
            soalIsianId: validate.soalIsianId,
            jawaban: validate.jawaban,
            isCorrect: false,
            isianHistoryId: validate.isianHistoryId,
        },
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menyimpan jawaban isian',
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
      kategoriSoalIsianId: Joi.number().optional(),
      isianHistoryId: Joi.number().optional(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};

    const where = {
      userId: userId,
      ...filterToJson(validate),
    };
    
    if (validate.kategoriSoalIsianId) where.kategoriSoalIsianId = validate.kategoriSoalIsianId;
    if (validate.isianHistoryId) {
        where.isianHistoryId = validate.isianHistoryId;
    }

    const result = await database.$transaction([
        database.historyIsian.findMany({
            ...take,
            skip: validate.skip,
            where: where,
            include: {
                soalIsian: true
            },
            orderBy: { createdAt: 'desc' }
        }),
        database.historyIsian.count({ where: where })
    ]);

    return returnPagination(req, res, result);

  } catch (error) {
    next(error);
  }
}

const generateSessionId = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const maxId = await database.historyIsian.aggregate({
            _max: {
                isianHistoryId: true
            },
            where: {
                userId: userId
            }
        });
        
        const newId = (maxId._max.isianHistoryId || 0) + 1;
        
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
      kategoriSoalIsianId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? validate.take : 10;
    const skip = validate.skip ? validate.skip : 0;

    const whereClause = {
        userId: userId,
        kategoriSoalIsianId: validate.kategoriSoalIsianId,
    };

    const groupedHistory = await database.historyIsian.groupBy({
        by: ['isianHistoryId'],
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
        skip: skip,
        take: take,
    });
    
    // Get total count (using non-paginated group by)
    const allGroups = await database.historyIsian.groupBy({
        by: ['isianHistoryId'],
        where: whereClause,    
    });
    const totalCount = allGroups.length;

    const transformedList = groupedHistory.map(group => {
        return {
            totalSoal: group._count.soalIsianId,
            totalScore: group._sum.score || 0,
            createdAt: group._max.createdAt,
            isianHistoryId: group.isianHistoryId
        };
    });

    return returnPagination(req, res, [transformedList, totalCount]);

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
