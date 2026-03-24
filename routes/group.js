import express from 'express';


const router = express.Router();


router.get('/', async (req, res, next) => {
  try {

    res.json({ message: 'Hello to group route' });
  } catch (error) {
    next(error);
  }
});

export default router;