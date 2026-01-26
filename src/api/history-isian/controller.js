
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
    });

    const validate = await schema.validateAsync(req.body);
    const userId = req.user.id;

    // Check if history already exists for this user and question
    const existingHistory = await database.historyIsian.findFirst({
        where: {
            userId: userId,
            soalIsianId: validate.soalIsianId
        }
    });

    let result;
    if (existingHistory) {
        // Update existing
        result = await database.historyIsian.update({
            where: { id: existingHistory.id },
            data: {
                jawaban: validate.jawaban,
                // isCorrect: false // Default/Reset to false on edit? Or keep as is? Schema default is false.
            }
        });
    } else {
        // Create new
        result = await database.historyIsian.create({
            data: {
                userId: userId,
                kategoriSoalIsianId: validate.kategoriSoalIsianId,
                soalIsianId: validate.soalIsianId,
                jawaban: validate.jawaban,
                isCorrect: false,
            },
        });
    }

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
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};

    const where = {
      userId: userId,
      ...filterToJson(validate),
    };
    
    if (validate.kategoriSoalIsianId) where.kategoriSoalIsianId = validate.kategoriSoalIsianId;

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

module.exports = {
  insert,
  getMyHistory
};
