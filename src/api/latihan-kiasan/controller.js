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
      includeSoal: Joi.boolean(),
      filters: Joi.object(),
    }).unknown(true);

    if (req.query.filters && typeof req.query.filters === 'string') {
        try {
            req.query.filters = JSON.parse(req.query.filters);
        } catch (e) {
            // ignore
        }
    }
    const validate = await schema.validateAsync(req.query);

    const take = validate.take ? { take: validate.take } : {};

    const include = {};
    // Check both filters.includeSoal and top-level includeSoal
    if (validate.filters?.includeSoal || validate.includeSoal) {
        include.soalLatihanKecermatan = true;
    }

    // Extract valid integer filters that shouldn't use 'contains'
    const whereClause = {};
    if (validate.filters?.kategoriLatihanKecermatanId) {
        whereClause.kategoriLatihanKecermatanId = Number(validate.filters.kategoriLatihanKecermatanId);
        delete validate.filters.kategoriLatihanKecermatanId;
    }

    const result = await database.$transaction([
      database.latihanKiasan.findMany({
        ...take,
        skip: validate.skip,
        orderBy: {
          [validate.sortBy || 'createdAt']: validate.descending ? 'desc' : 'asc',
        },
        where: {
          ...whereClause,
          ...filterToJson(validate),
        },
        include: include,
      }),
      database.latihanKiasan.count({
        where: {
          ...whereClause,
          ...filterToJson(validate),
        },
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

    const result = await database.latihanKiasan.findUnique({
      where: {
        id: validate.id,
      },
      include: {
        soalLatihanKecermatan: true,
      }
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
    console.log('Insert Body:', req.body);
    console.log('User:', req.user);

    const schema = Joi.object({
   
      // karakter: Joi.array().required(), // Removed as per schema
      kiasan: Joi.array().required(),   // Validate as array
      waktu: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.body);

    // Verify parent exists if provided
    if (validate.kategoriLatihanKecermatanId) {
      const parentExist = await database.kategoriLatihanKecermatan.findUnique({
        where: { id: validate.kategoriLatihanKecermatanId },
      });
      if (!parentExist) throw new BadRequestError('Kategori Latihan Kecermatan tidak ditemukan');
    }

    const result = await database.latihanKiasan.create({
      data: {
        userId: req.user.id,
        kategoriLatihanKecermatanId: validate.kategoriLatihanKecermatanId,
        kiasan: validate.kiasan,
        waktu: validate.waktu,
      },
      include: {
        soalLatihanKecermatan: true, // Include relative relation if needed
      }
    });

    // Generate 50 Soal for this Kiasan
    const soalData = [];
    const kiasanArr = validate.kiasan; // Array of 5 chars

    for (let i = 0; i < 50; i++) {
        // Randomly pick one index as the answer (the missing char or the target)
        // User said: "Ambil 4 karakter dari kiasan... yang 1 adalah jawabannya"
        // Interpretation: Missing Symbol logic. The missing one is the answer.
        const answerIndex = Math.floor(Math.random() * kiasanArr.length);
        const answerChar = kiasanArr[answerIndex];
        
        // The question is the user seeing the OTHER 4 characters
        // Shuffle the 4 remaining characters
        const questionChars = kiasanArr.filter((_, index) => index !== answerIndex);
        
        // Shuffle array helper
        const shuffledQuestion = questionChars.sort(() => 0.5 - Math.random());

        soalData.push({
            kiasanId: result.id,
            soal: shuffledQuestion, // Store as JSON array
            jawaban: answerChar,
        });
    }

    // Batch insert soal
    await database.soalLatihanKecermatan.createMany({
        data: soalData,
    });

    res.status(200).json({
      data: result,
      msg: 'Berhasil menambahkan Kiasan dan 50 Soal',
    });
  } catch (error) {
    console.error('Insert Error:', error);
    next(error);
  }
};

const saveHistory = async (req, res, next) => {
  try {
    console.log('HIT saveHistory');
    console.log('Body:', req.body);
    console.log('User:', req.user);

    const schema = Joi.object({
      kategoriLatihanKecermatanId: Joi.number().required(),
      latihanKiasanId: Joi.number().required(),
      soalLatihanKecermatanId: Joi.number().required(),
      jawaban: Joi.string().required(),
    });

    const validate = await schema.validateAsync(req.body);
    console.log('Validate success:', validate);

    const result = await database.latihanKecermatanHistory.create({
      data: {
        userId: req.user.id,
        kategoriLatihanKecermatanId: validate.kategoriLatihanKecermatanId,
        latihanKiasanId: validate.latihanKiasanId,
        soalLatihanKecermatanId: validate.soalLatihanKecermatanId,
        jawaban: validate.jawaban,
      },
    });
    console.log('Create result:', result);

    res.status(200).json({
      data: result,
      msg: 'Berhasil menyimpan history latihan',
    });
  } catch (error) {
    console.error('Save History Error:', error);
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

    const isExist = await database.latihanKiasan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kiasan tidak ditemukan');

    const result = await database.latihanKiasan.update({
      where: {
        id: validate.id,
      },
      data: {
        // Update fields if needed
        waktu: validate.waktu,
        kiasan: validate.kiasan
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

    const isExist = await database.latihanKiasan.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError('Kiasan tidak ditemukan');

    const result = await database.latihanKiasan.delete({
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
      kategoriSoalKecermatanId: Joi.number().required(),
      search: Joi.string().allow(null, ''),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};
    const skip = validate.skip ? { skip: validate.skip } : {};

    const whereClause = {
      kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
    };

    if (validate.search) {
      whereClause.user = {
        name: {
          contains: validate.search,
        },
      };
    }

    const result = await database.$transaction([
      database.kecermatanRanking.findMany({
        ...take,
        ...skip,
        where: whereClause,
        include: {
          user: {
            select: {
              name: true,
              email: true,
              gambar: true,
            },
          },
        },
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

const getUserHistory = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      kategoriSoalKecermatanId: Joi.number().required(),
      userId: Joi.number().required(),
    }).unknown(true);

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};
    const skip = validate.skip ? { skip: validate.skip } : {};

    const result = await database.$transaction([
      database.kecermatanHistory.findMany({
        ...take,
        ...skip,
        where: {
          userId: validate.userId,
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
          userId: validate.userId,
          kategoriSoalKecermatanId: validate.kategoriSoalKecermatanId,
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
  saveHistory,
};
