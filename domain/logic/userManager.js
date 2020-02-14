const User = require('../models/user.class');

class UserManager {
    constructor(repo) {
        this.repo = repo;
    }

    /**
     * Login an already created user or register it.
     * @param {Object} userInfo Users info obtained by a third party issued token
     * @param {number} userInfo.accountId User's id of the third party
     * @param {string} userInfo.accountType Third party name
     * @param {string} userInfo.firstname User's firstname
     * @param {string} userInfo.lastname User's lastname
     * @param {string} userInfo.email User's email
     */
    async login(userInfo) {
        let user = new User(userInfo);
        try {
            user = await this.getUser(user.uniqueId);
        } catch (err) {
            await this.register(user);
        }
        return user;
    }

    /**
     * Registers a new user
     * @param {User} user User to register
     */
    register(user) {
        return this.repo.userCreated(user);
    }

    /**
     * Gets an already registered user
     * @param {string} userId User id
     */
    getUser(userId) {
        return this.repo.getUser(userId);
    }
}

module.exports = UserManager;
