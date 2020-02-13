const uuid = require('uuid/v4');
const Role = require('./role.class');
const OrganizationError = require('../errors/organization.error');

class Organization {
    /**
     * @constructor
     * @param {string} name The name of the organization
     */
    constructor(name) {
        this.id = uuid();
        this.name = name;
        this._roles = {};
        this.users = {}; // Keeps track of users id of the organization and their roles
    }

    /**
     * Adds a new Role to the Organization. If already present throws an error.
     * @param {Role} role The role to add to the organization
     */
    addRole(role) {
        if (!(role instanceof Role))
            throw OrganizationError.paramError('role must be an instance of Role');
        if (this._roles[role.name])
            throw OrganizationError.roleAlreadyExistsError(`role with name ${role.name} already exists`);
        this._roles[role.name] = role;
    }

    /**
     * Removes an existing Role from the Organization.  
     * If not present, throws an error.
     * @param {string} roleName Name identifying the role to remove
     */
    removeRole(roleName) {
        if (typeof roleName !== 'string')
            throw OrganizationError.paramError('roleName must be a string');
        delete this._roles[role.name];
    }

    /**
     * Adds a new user to the Organization, assigning the indicated roles to it if present.  
     * If user is already in the organization, throws an error.
     * @param {string} userId The id of the user to add
     * @param {string[]} [roles] An array of names of roles
     */
    addUser(userId, roles) {
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (this.users[userId])
            throw OrganizationError.userAlreadyExistsError(`user with id ${userId} already exists in the organization`);
        this.users[userId] = new Set();
        if (roles)
            this.assignRoles(userId, roles);
    }

    /**
     * Assigns the indicated roles to the user.  
     * If user is not present in the Organization, throws an error.  
     * If some role does not exist in the Organization, throws an error.
     * @param {string} userId The id of the user to which assign the roles
     * @param {string[]} roles An array of names of roles
     */
    assignRolesToUser(userId, roles) {
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (!this.users[userId])
            throw OrganizationError.userDoesNotExistError(`user with id ${userId} does not exist in the organization`);
        if (!Array.isArray(roles) || roles.length <= 0 || typeof roles[0] !== 'string')
            throw OrganizationError.paramError('roles must be a non empty array of role names');
        roles.forEach(r => {
            if (!this._roles[r])
                throw OrganizationError.roleDoesNotExistError(`role ${r} does not exist in the organization`);
            this.users[userId].add(r);
        });
    }

    /**
     * Removes the indicated roles from the user.  
     * If user is not present in the Organization, throws an error.  
     * If some role does not exist in the Organization, throws an error.
     * @param {string} userId The id of the user to which remove the roles
     * @param {string[]} roles An array of names of roles
     */
    removeRolesFromUser(userId, roles) {
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (!this.users[userId])
            throw OrganizationError.userDoesNotExistError(`user with id ${userId} does not exist in the organization`);
        if (!Array.isArray(roles) || roles.length <= 0 || typeof roles[0] !== 'string')
            throw OrganizationError.paramError('roles must be a non empty array of role names');
        roles.forEach(r => {
            if (!this._roles[r])
                throw OrganizationError.roleDoesNotExistError(`role ${r} does not exist in the organization`);
            this.users[userId].delete(r);
        });
    }

    /**
     * Removes an user from the Organization
     * @param {string} userId The id of the user to remove from the Organization
     */
    removeUser(userId) {
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (!this.users[userId])
            throw OrganizationError.userDoesNotExistError(`user with id ${userId} does not exist in the organization`);
        delete this.users[userId];
    }

    get roles() {
        return Object.values(this._roles);
    }
}

module.exports = Organization;
