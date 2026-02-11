const bcrypt = require('bcryptjs');
const Joi = require('joi');

const { StatusCodes } = require('http-status-codes');
const { BadRequestError } = require('../../errors');
const moment = require('moment');

const database = require('#database');
const { generateToken, sendMail, isTokenValid } = require('#utils');
const register = async (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(3).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    noWA: Joi.string(),
    affiliate_code: Joi.string().allow(null, ''), // tambahkan agar bisa input kode affiliate
  });

  try {
    const validate = await schema.validateAsync(req.body);

    // Cek apakah email sudah digunakan
    const isEmailExist = await database.User.findUnique({
      where: { email: validate.email },
    });
    if (isEmailExist) throw new BadRequestError('Email telah digunakan');

    // Cek apakah noWA sudah digunakan
    if (validate.noWA) {
      const isNoWAExist = await database.User.findFirst({
        where: { noWA: validate.noWA },
      });
      if (isNoWAExist) throw new BadRequestError('No Whatsapp telah digunakan');
    }

    // Cek kode affiliate (referrer)
    let affiliateFromUserId = null;
    if (validate.affiliate_code) {
      const referrerUser = await database.User.findFirst({
        where: { affiliateCode: validate.affiliate_code },
      });
      if (referrerUser) {
        affiliateFromUserId = referrerUser.id;
      }
    }

    // Generate affiliateCode unik untuk user baru
    let affiliateCode;
    let unique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!unique && attempts < maxAttempts) {
      attempts++;
      affiliateCode = `AFFU${moment().unix()}${Math.floor(Math.random() * 900 + 100)}`;
      const exists = await database.User.findFirst({
        where: { affiliateCode },
      });
      if (!exists) unique = true;
      else await new Promise((r) => setTimeout(r, 50));
    }

    if (!unique) throw new BadRequestError('Gagal membuat kode afiliasi unik. Silakan coba lagi.');

    // Buat user baru
    const user = await database.User.create({
      data: {
        name: validate.name,
        email: validate.email,
        password: bcrypt.hashSync(validate.password, 10),
        noWA: validate.noWA || null,
        affiliateFromUserId: affiliateFromUserId, // ✅ perbaikan di sini
        affiliateCode,
        affiliateLink: `https://bimbel.fungsional.id/auth/register/${affiliateCode}`,
        affiliateStatus: 'active',
        affiliateCommission: 0,
        affiliateBalance: 0.0,
      },
    });

    // Kirim email konfirmasi
    const token = generateToken(user);
    sendMail({
      to: user.email,
      subject: 'Please Confirm Your Email',
      template: 'register.html',
      name: validate.name,
      url: `${process.env.URL_SERVER}/auth/confirm-email/${token}`,
    });

    // Response sukses
    res.status(StatusCodes.CREATED).json({
      data: user,
      msg: 'User created',
    });
  } catch (error) {
    next(error);
  }
};



const login = async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
    });

    const validate = await schema.validateAsync(req.body);

    const user = await database.User.findUnique({
      where: {
        email: validate.email,
      },
    });

    if (!user) throw new BadRequestError('Email belum terdaftar');

    const checkPassword = bcrypt.compareSync(validate.password, user.password);

    if (!checkPassword) throw new BadRequestError('Password salah');

    // if (!user.verifyAt) {
    //   throw new BadRequestError('Silahkan verifikasi email anda');
    // }

    await database.User.update({
      where: {
        id: user.id,
      },
      data: {
        jwtVersion: {
          increment: 1,
        },
      },
    });

    user.jwtVersion += 1;
    const token = generateToken(user);

    res.status(StatusCodes.OK).json({
      data: {
        token,
        user,
      },
      msg: 'Login Berhasil',
    });
  } catch (error) {
    next(error);
  }
};

const { verifyGoogleToken } = require('../../services/google-auth.service');

const googleLogin = async (req, res, next) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      throw new BadRequestError('Access Token diperlukan');
    }

    // Verify Google Token
    const googleUser = await verifyGoogleToken(access_token);
    
    // Check if user exists
    let user = await database.User.findUnique({
      where: { email: googleUser.email },
    });

    if (!user) {
      // Create new user
      const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
      
      // Generate affiliate code
      let affiliateCode;
      let unique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!unique && attempts < maxAttempts) {
        attempts++;
        affiliateCode = `AFFU${moment().unix()}${Math.floor(Math.random() * 900 + 100)}`;
        const exists = await database.User.findFirst({
          where: { affiliateCode },
        });
        if (!exists) unique = true;
        else await new Promise((r) => setTimeout(r, 50));
      }

      user = await database.User.create({
        data: {
          name: googleUser.name,
          email: googleUser.email,
          password: bcrypt.hashSync(randomPassword, 10),
          verifyAt: new Date(), // Auto verify for Google users
          affiliateCode,
          affiliateLink: `https://bimbel.fungsional.id/auth/register/${affiliateCode}`,
          affiliateStatus: 'active',
          affiliateCommission: 0,
          affiliateBalance: 0.0,
        },
      });
    }

    // Login logic
    await database.User.update({
      where: { id: user.id },
      data: {
        jwtVersion: { increment: 1 },
      },
    });

    user.jwtVersion += 1;
    const token = generateToken(user);

    res.status(StatusCodes.OK).json({
      data: {
        token,
        user,
      },
      msg: 'Login Berhasil via Google',
    });

  } catch (error) {
    console.error('Google Login Error:', error);
    next(error);
  }
};

const confirmEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const decodeToken = isTokenValid({ token });

    const user = await database.User.findUnique({
      where: {
        id: decodeToken.id,
      },
    });

    if (!user) throw new BadRequestError('Token tidak valid');

    await database.User.update({
      where: {
        id: decodeToken.id,
      },
      data: {
        verifyAt: new Date(),
      },
    });

    res.redirect(`${process.env.URL_CLIENT}/auth/login`);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const schema = Joi.object({
      email: Joi.string().email().required(),
    });

    const validate = await schema.validateAsync(req.body);

    const user = await database.User.findUnique({
      where: {
        email: validate.email,
      },
    });

    if (!user) throw new BadRequestError('Email belum terdaftar');

    const token = generateToken(user, '15m');

    sendMail({
      to: user.email,
      subject: 'Reset Password Fungsional',
      template: 'forgot-password.html',
      name: user.name,
      url: `${process.env.URL_CLIENT}/auth/reset-password/${token}`,
    });

    res.status(StatusCodes.OK).json({
      msg: 'Email reset password telah dikirim',
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const schema = Joi.object({
      password: Joi.string().min(8).required(),
      token: Joi.string().required(),
    });

    const validate = await schema.validateAsync(req.body);
    const decodeToken = isTokenValid({ token: validate.token });

    await database.User.update({
      where: {
        id: decodeToken.id,
      },
      data: {
        password: bcrypt.hashSync(validate.password, 10),
      },
    });

    res.status(StatusCodes.OK).json({
      msg: 'Password berhasil diubah',
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  register,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  confirmEmail,
};
