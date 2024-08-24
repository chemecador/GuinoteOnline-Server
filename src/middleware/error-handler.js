export const errorHandler = (err, req, res, next) => {
    console.error(err.stack);

    if (err.code === '23505') {
        return res.status(400).send({ message: 'Duplicate key error: ' + err.detail });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).send({ message: err.message });
    }

    if (process.env.NODE_ENV === 'development') {
        return res.status(500).send({
            message: 'Internal Server Error',
            error: err.message,
            stack: err.stack,
        });
    }

    res.status(500).send({ message: 'Internal Server Error' });
};