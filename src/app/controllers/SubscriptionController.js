import { Op } from 'sequelize';

import Subscription from '../models/Subscription';
import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';

import Queue from '../../lib/Queue';
import SubscriptionMail from '../jobs/SubscriptionMail';

class SubscriptionController {
  async create(req, res) {
    const { meetupId } = req.params;

    const meetup = await Meetup.findByPk(meetupId, {
      include: [
        {
          model: User,
          as: 'organizer',
          attributes: ['name', 'email'],
        },
      ],
    });

    if (!meetup) {
      return res.status(400).json({
        error: 'Meetup does not exist',
      });
    }

    if (meetup.user_id === req.userId) {
      return res.status(400).json({
        error: 'You cannot subscribe to your own meetings',
      });
    }

    if (meetup.past) {
      return res.status(400).json({
        error: 'You are not allowed to register for past meetings',
      });
    }

    const alreadySubscribed = await Subscription.findOne({
      where: { meetup_id: meetupId, user_id: req.userId },
    });

    if (alreadySubscribed) {
      return res.status(400).json({
        error: 'You are already subscribed to this meetup',
      });
    }

    const sameTime = await Subscription.findOne({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          where: {
            date: meetup.date,
          },
        },
      ],
    });

    if (sameTime) {
      return res.status(400).json({
        error: 'You are already subscribed to another meetup at the same time',
      });
    }

    const subscription = await Subscription.create({
      meetup_id: meetupId,
      user_id: req.userId,
    });

    const user = await User.findByPk(req.userId, {
      attributes: ['name', 'email'],
    });

    Queue.add(SubscriptionMail.key, {
      meetup,
      user,
    });

    return res.json(subscription);
  }

  async findAll(req, res) {
    const meetups = await Subscription.findAll({
      where: {
        user_id: req.userId,
      },
      attributes: ['id'],
      include: [
        {
          model: Meetup,
          attributes: ['id', 'title', 'description', 'location', 'date'],
          where: {
            date: {
              [Op.gt]: new Date(),
            },
          },
          include: [
            {
              model: User,
              as: 'organizer',
              attributes: ['name'],
            },
            {
              model: File,
              as: 'banner',
              attributes: ['url', 'filename'],
            },
          ],
        },
      ],
      order: [[Meetup, 'date', 'ASC']],
    });

    return res.json(meetups);
  }

  async delete(req, res) {
    const subscription = await Subscription.findOne({
      where: {
        id: req.params.id,
        user_id: req.userId,
      },
    });

    if (!subscription) {
      return res.status(403).json({
        error:
          'You are not subscribed to the meetup you are trying to unsubscribe',
      });
    }

    const meetup = await Meetup.findByPk(subscription.meetup_id);

    if (meetup.past) {
      return res.status(403).json({
        error: 'Unable to unsubscribe from a Meetup that has already happened',
      });
    }

    await subscription.destroy();

    return res.send();
  }
}

export default new SubscriptionController();
