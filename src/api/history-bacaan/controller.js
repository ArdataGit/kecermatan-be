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
      kategoriSoalBacaanId: Joi.number().optional(), // Not strictly needed for history table but good for context
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
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};

    const where = {
      userId: userId,
      ...filterToJson(validate),
    };
    
    if (validate.bacaanId) where.bacaanId = validate.bacaanId;

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

module.exports = {
  insert,
  getMyHistory
};
