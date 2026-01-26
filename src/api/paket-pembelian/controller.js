const Joi = require("joi");

const database = require("#database");
const { returnPagination, filterToJson, deleteFile } = require("#utils");
const { BadRequestError } = require("#errors");

const get = async (req, res, next) => {
  try {
    const schema = Joi.object({
      skip: Joi.number(),
      take: Joi.number(),
      sortBy: Joi.string(),
      descending: Joi.boolean(),
      filters: Joi.object(),
    });

    const validate = await schema.validateAsync(req.query);
    const take = validate.take ? { take: validate.take } : {};
    let orderBy = undefined;

    if (validate.sortBy) {
      if (validate.sortBy === "pembeli") {
        orderBy = { createdAt: "desc" }; // dummy, sorting real-nya manual
      } else {
        orderBy = {
          [validate.sortBy]: validate.descending ? "desc" : "asc",
        };
      }
    }

    const result = await database.$transaction([
      database.paketPembelian.findMany({
        ...take,
        skip: validate.skip,
        where: filterToJson(validate),
        orderBy: orderBy,
        select: {
          id: true,
          nama: true,
          harga: true,
          keterangan: true,
          Pembelian: true,
          linkWa:true,
          isActive: true,
          durasi: true,
          createdAt: true,
          panduan: true,
          gambar: true,
          paketPembelianFitur: {
            select: {
              nama: true,
            },
          },
          paketPembelianCategory: {
            select: {
              nama: true,
            },
          },
          _count: {
            select: {
              paketPembelianMateri: true,
              paketPembelianBimbel: true,
              paketPembelianFitur: true,
              paketPembelianTryout: true,
              paketPembelianKecermatan: true,
              paketPembelianBacaan: true,
              Pembelian: true,
            },
          },
        },
      }),
      database.paketPembelian.count({
        where: filterToJson(validate),
      }),
    ]);

    if (!!validate.sortBy && validate.sortBy == "pembeli") {
      result[0] = result[0].sort((a, b) => {
        return !!validate.descending
          ? b._count.Pembelian - a._count.Pembelian
          : a._count.Pembelian - b._count.Pembelian;
      });
    }

    return returnPagination(req, res, result);
  } catch (error) {
    next(error);
  }
};

// const get = async (req, res, next) => {
//   try {
//     const schema = Joi.object({
//       skip: Joi.number(),
//       take: Joi.number(),
//       sortBy: Joi.string(),
//       descending: Joi.boolean(),
//       filters: Joi.object(),
//     });

//     const validate = await schema.validateAsync(req.query);
//     const take = validate.take ? { take: validate.take } : {};
//     const where = filterToJson(validate);
//     const orderBy =
//       validate.sortBy == "pembeli"
//         ? undefined
//         : { [validate.sortBy]: validate.descending ? "desc" : "asc" };

//     const query = {
//       where: where,
//       orderBy: orderBy,
//       select: {
//         id: true,
//         nama: true,
//         harga: true,
//         keterangan: true,
//         isActive: true,
//         durasi: true,
//         createdAt: true,
//         panduan: true,
//         gambar: true,
//         _count: {
//           select: {
//             paketPembelianMateri: true,
//             paketPembelianBimbel: true,
//             paketPembelianFitur: true,
//             paketPembelianTryout: true,
//             Pembelian: true,
//           },
//         },
//         paketPembelianFitur: {
//           select: {
//             nama: true,
//           },
//         },
//         paketPembelianCategory: {
//           select: {
//             nama: true,
//           },
//         },
//       },
//     };
//     let ids = [];
//     const paketPembelianData = await database.paketPembelian.findMany(query);
//     let items = paketPembelianData;
//     if (!!validate.filters?.pembeli) {
//       ids = items
//         .filter(
//           (paket) =>
//             paket._count.Pembelian === Number(validate.filters?.pembeli)
//         )
//         .map((data) => data.id);
//     }

//     items = await database.paketPembelian.findMany({
//       ...query,
//       ...take,
//       skip: validate.skip,
//       where: {
//         ...where,
//         ...(validate.filters?.pembeli && { id: { in: ids } }),
//       },
//     });

//     const totalPaket = await database.paketPembelian.count({
//       where: {
//         ...where,
//         ...(validate.filters?.pembeli && { id: { in: ids } }),
//       },
//     });

//     const result = [items, totalPaket];

//     return returnPagination(req, res, result);
//   } catch (error) {
//     next(error);
//   }
// };

const find = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
    });

    const validate = await schema.validateAsync(req.params);

    const result = await database.paketPembelian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!result) throw new BadRequestError("Paket tidak ditemukan");

    res.status(200).json({
      data: result,
      msg: "Get data by id",
    });
  } catch (error) {
    next(error);
  }
};

const insert = async (req, res, next) => {
  try {
    const schema = Joi.object({
      nama: Joi.string().required(),
      harga: Joi.number().required(),
      keterangan: Joi.allow(null, ""),
      linkWa: Joi.allow(null, ""),
      durasi: Joi.number(),
      gambar: Joi.string(),
      category: Joi.string(),
      panduan: Joi.string(),
      isActive: Joi.string(),
    });

    const { category, ...validate } = await schema.validateAsync(
      { ...req.body, gambar: req?.file?.path },
      {
        stripUnknown: true,
      }
    );
    const categoryJSON = JSON.parse(category);

    if (validate.isActive === "1" || validate.isActive === true) {
      validate.isActive = true;
    } else {
      validate.isActive = false;
    }
    const result = await database.paketPembelian.create({
      data: validate,
    });

    await database.paketPembelianCategory.createMany({
      data: categoryJSON.map((item) => ({
        paketPembelianId: result.id,
        nama: item,
      })),
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil menambahkan paket pembelian",
    });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const schema = Joi.object({
      id: Joi.number().required(),
      nama: Joi.string().required(),
      harga: Joi.number().required(),
      keterangan: Joi.allow(null, ""),
      linkWa: Joi.allow(null, ""),
      durasi: Joi.number(),
      gambar: Joi.string(),
      category: Joi.string(),
      panduan: Joi.string(),
      isActive: Joi.string(),
    });

    const { category, ...validate } = await schema.validateAsync(
      {
        ...req.body,
        ...req.params,
        gambar: req?.file?.path,
      },
      {
        stripUnknown: true,
      }
    );

    const isExist = await database.paketPembelian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError("Paket Pembelian tidak ditemukan");

    if (req?.file?.path) {
      deleteFile(isExist.gambar);
    }

    if (validate.isActive === "1" || validate.isActive === true) {
      validate.isActive = true;
    } else {
      validate.isActive = false;
    }

    const result = await database.paketPembelian.update({
      where: {
        id: validate.id,
      },
      data: validate,
    });

    const categoryJSON = JSON.parse(category);

    await database.paketPembelianCategory.deleteMany({
      where: {
        paketPembelianId: result.id,
      },
    });

    await database.paketPembelianCategory.createMany({
      data: categoryJSON.map((item) => ({
        paketPembelianId: result.id,
        nama: item,
      })),
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil mengubah data paket pembelian",
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

    const isExist = await database.paketPembelian.findUnique({
      where: {
        id: validate.id,
      },
    });

    if (!isExist) throw new BadRequestError("Paket Pembelian tidak ditemukan");

    const result = await database.paketPembelian.delete({
      where: {
        id: validate.id,
      },
    });

    res.status(200).json({
      data: result,
      msg: "Berhasil menghapus Paket Pembelian",
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
};
