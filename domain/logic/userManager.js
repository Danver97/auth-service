const User = require('../models/user.class');

class UserManager {
    constructor(repo) {
        this.repo = repo;
    }

    login(userInfo) {
        const user = new User(userInfo);
        try {
            await this.getUser(user.uniqueId);
        } catch (err) {
            await this.register(user);
        }
        return user;
    }

    register(user) {
        return this.repo.register(user);
    }

    getUser(userId) {
        return this.repo.getUser(userId);
    }
}

