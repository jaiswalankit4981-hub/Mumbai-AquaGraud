export function notFound(_req, res) {
  res.status(404).json({ success: false, message: 'Endpoint not found.' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : 500);
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    success: false,
    message: err.message || 'Something went wrong on the server.'
  });
}
