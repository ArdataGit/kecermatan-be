const jwt = require('jsonwebtoken');

const isTokenValid = ({ token }) => jwt.verify(token, process.env.JWT_SECRET);

const generateToken = (payload, exp) => {
  const result = {
    id: payload.id,
    email: payload.email,
    jwtVersion: payload.jwtVersion,
  };
  return jwt.sign(result, process.env.JWT_SECRET, {
    expiresIn: exp || '20d',
  });
};

module.exports = {
  isTokenValid,
  generateToken,
};
