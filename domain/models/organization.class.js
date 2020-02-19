const uuid = require('uuid/v4');
const Role = require('./role.class');
const OrganizationError = require('../errors/organization.error');

class Organization {
    /**
     * @constructor
     * @param {string} name The name of the organization
     */
    constructor(name) {
        if (!name)
            throw OrganizationError.paramError('Missing the following constructor parameter: name');
        if (typeof name !== 'string')
            throw OrganizationError.paramError('name must be a string');
        this.orgId = uuid();
        this.name = name;
        this._roles = {};
        this._users = {}; // Keeps track of users id of the organization and their roles
    }

    /**
     * @param {Object} obj JSON object
     * @param {string} obj.orgId
     * @param {string} obj.name
     * @param {Object[]} obj.roles
     * @param {string} obj.roles[].roleId
     * @param {string} obj.roles[].name
     * @param {Object[]} obj.roles[].permissions
     * @param {string} obj.roles[].permissions[].scope
     * @param {string} obj.roles[].permissions[].name
     * @param {string} obj.roles[].permissions[].description
     * @param {Object[]} obj.users[]
     * @param {string} obj.users[].userId
     * @param {string[]} obj.users[].roles
     */
    static fromObject(obj) {
        if (!obj)
            throw OrganizationError.paramError('Missing the following paramter: obj');
        const org = new Organization(obj.name);
        org.orgId = obj.orgId;
        obj.roles.forEach(r => {
            const role = Role.fromObject(r);
            org.addRole(role);
        });
        obj.users.forEach(u => {
            org.addUser(u.userId, u.roles);
        });
        return org;
    }

    isDeleted() {
        return this.status === 'deleted';
    }

    delete() {
        this._checkIfDeleted();
        this.status = 'deleted';
    }

    _checkIfDeleted() {
        if (this.isDeleted())
            throw OrganizationError.organizationDeletedError('Organization is deleted and no more action can be taken on it');
    }

    /**
     * Adds a new Role to the Organization. If already present throws an error.
     * @param {Role} role The role to add to the organization
     */
    addRole(role) {
        this._checkIfDeleted();
        if (!(role instanceof Role))
            throw OrganizationError.paramError('role must be an instance of Role');
        if (this._roles[role.roleId])
            throw OrganizationError.roleAlreadyExistsError(`role with id ${role.roleId} already exists`);
        this._roles[role.roleId] = role;
    }

    /**
     * Removes an existing Role from the Organization.  
     * If not present, throws an error.
     * @param {string} roleName Name identifying the role to remove
     */
    removeRole(roleId) {
        this._checkIfDeleted();
        if (typeof roleId !== 'string')
            throw OrganizationError.paramError('roleId must be a string');
        if (!this._roles[roleId])
            throw OrganizationError.roleDoesNotExistError(`role with id ${roleId} does not exist`);
        delete this._roles[roleId];
    }

    /**
     * Adds a new user to the Organization, assigning the indicated roles to it if present.  
     * If user is already in the organization, throws an error.
     * @param {string} userId The id of the user to add
     * @param {string[]} [roles] An array of role ids
     */
    addUser(userId, roles) {
        this._checkIfDeleted();
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (this._users[userId])
            throw OrganizationError.userAlreadyExistsError(`user with id ${userId} already exists in the organization`);
        this._users[userId] = new Set();
        if (roles)
            this.assignRolesToUser(userId, roles);
    }

    /**
     * Assigns the indicated roles to the user.  
     * If user is not present in the Organization, throws an error.  
     * If some role does not exist in the Organization, throws an error.
     * @param {string} userId The id of the user to which assign the roles
     * @param {string[]} roles An array of role ids
     */
    assignRolesToUser(userId, roles) {
        this._checkIfDeleted();
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (!this._users[userId])
            throw OrganizationError.userDoesNotExistError(`user with id ${userId} does not exist in the organization`);
        if (!Array.isArray(roles) || roles.length <= 0 || typeof roles[0] !== 'string')
            throw OrganizationError.paramError('roles must be a non empty array of role ids');
        roles.forEach(r => {
            if (!this._roles[r])
                throw OrganizationError.roleDoesNotExistError(`role ${r} does not exist in the organization`);
            this._users[userId].add(r);
        });
    }

    /**
     * Removes the indicated roles from the user.  
     * If user is not present in the Organization, throws an error.  
     * If some role does not exist in the Organization, throws an error.
     * @param {string} userId The id of the user to which remove the roles
     * @param {string[]} roles An array of role ids
     */
    removeRolesFromUser(userId, roles) {
        this._checkIfDeleted();
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (!this._users[userId])
            throw OrganizationError.userDoesNotExistError(`user with id ${userId} does not exist in the organization`);
        if (!Array.isArray(roles) || roles.length <= 0 || typeof roles[0] !== 'string')
            throw OrganizationError.paramError('roles must be a non empty array of role ids');
        roles.forEach(r => {
            if (!this._roles[r])
                throw OrganizationError.roleDoesNotExistError(`role ${r} does not exist in the organization`);
            this._users[userId].delete(r);
        });
    }

    /**
     * Removes an user from the Organization
     * @param {string} userId The id of the user to remove from the Organization
     */
    removeUser(userId) {
        this._checkIfDeleted();
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (!this._users[userId])
            throw OrganizationError.userDoesNotExistError(`user with id ${userId} does not exist in the organization`);
        delete this._users[userId];
    }

    get id() {
        return this.orgId;
    }

    get roles() {
        return Object.values(this._roles);
    }

    get users() {
        return Object.keys(this._users)
            .map(k => ({ userId: k, roles: Array.from(this._users[k].values()) }));
    }

    toJSON() {
        return {
            orgId: this.orgId,
            name: this.name,
            roles: this.roles,
            users: this.users,
        };
    }
}

module.exports = Organization;
