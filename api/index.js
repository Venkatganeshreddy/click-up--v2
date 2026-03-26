module.exports = (req, res) => {
  res.status(200).json({ message: 'hello', path: req.url });
};
