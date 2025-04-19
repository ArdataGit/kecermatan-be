const filterToJson = (validate) => {
  if (!validate.filters) return {};
  
  const result = Object.keys(validate.filters).reduce((acc, key) => {
	if (key !== "pembeli") {

      acc[key] = {
        contains: validate.filters[key],
      }
	}
    return acc;
  }, {});

  return result;
};

module.exports = filterToJson;

