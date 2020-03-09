const uuid = require('uuid/v4');
const RoleDefinition = require('./roleDef.class');
const RoleInstance = require('./roleInstance.class');
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
     * @param {string} obj.roles[].roleDefId
     * @param {string} obj.roles[].name
     * @param {Object[]} obj.roles[].permissions
     * @param {string} obj.roles[].permissions[].scope
     * @param {string} obj.roles[].permissions[].name
     * @param {string} obj.roles[].permissions[].description
     * @param {Object} obj.roles[].paramMapping The parameterMapping of the RoleDefinition
     * @param {Object} obj.roles[].paramMapping.param_id id of the RoleDefinition parameter
     * @param {string} [obj.roles[].paramMapping.param_id.name] Readable name of the RoleDefinition parameter
     * @param {string} [obj.roles[].paramMapping.param_id.description] Description of the RoleDefinition parameter
     * @param {string} [obj.roles[].paramMapping.param_id.required] true/false, tells if the RoleDefinition parameter is required
     * @param {string} obj.roles[].paramMapping.param_id.mapping The parameter of the PermissionDefinition to which this RoleDefinition parameter is mapped
     * @param {Object[]} obj.users[]
     * @param {string} obj.users[].userId
     * @param {string[]} obj.users[].roles
     */
    static fromObject(obj) {
        if (!obj)
            throw OrganizationError.paramError('Missing the following paramter: obj');
        const org = new Organization(obj.name);
        org.orgId = obj.orgId;
        if (obj.roles)
            obj.roles.forEach(r => {
                const role = RoleDefinition.fromObject(r);
                org.addRoleDefinition(role);
            });
        if (obj.users)
            obj.users.forEach(u => {
                const userRoles = u.roles.map(ri => new RoleInstance({roleDef: org.getRoleDefinition(ri.roleDefId), paramValues: ri.paramValues}));
                org.addUser(u.userId, userRoles);
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
     * @param {Role} roleDef The role to add to the organization
     */
    addRoleDefinition(roleDef) {
        this._checkIfDeleted();
        if (!(roleDef instanceof RoleDefinition))
            throw OrganizationError.paramError('role must be an instance of RoleDefinition');
        if (this._roles[roleDef.roleDefId])
            throw OrganizationError.roleAlreadyExistsError(`role with id ${roleDef.roleDefId} already exists`);
        this._roles[roleDef.roleDefId] = roleDef;
    }

    /**
     * Retrieves a Role from the Organization.  
     * If not present, throws an error.
     * @param {string} roleDefId Id identifying the role to remove
     * @returns {RoleDefinition}
     */
    getRoleDefinition(roleDefId) {
        this._checkIfDeleted();
        if (typeof roleDefId !== 'string')
            throw OrganizationError.paramError('roleId must be a string');
        if (!this._roles[roleDefId])
            throw OrganizationError.roleDoesNotExistError(`role with id ${roleDefId} does not exist`);
        return this._roles[roleDefId];
    }

    /**
     * Removes an existing Role from the Organization.  
     * If not present, throws an error.
     * @param {string} roleDefId Id identifying the role to remove
     */
    removeRoleDefinition(roleDefId) {
        this._checkIfDeleted();
        if (typeof roleDefId !== 'string')
            throw OrganizationError.paramError('roleId must be a string');
        if (!this._roles[roleDefId])
            throw OrganizationError.roleDoesNotExistError(`role with id ${roleDefId} does not exist`);
        delete this._roles[roleDefId];
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
        this._users[userId] = new Map();
        if (roles)
            this.assignRolesToUser(userId, roles);
    }

    /**
     * Assigns the indicated roles to the user.  
     * If user is not present in the Organization, throws an error.  
     * If some role does not exist in the Organization, throws an error.
     * @param {string} userId The id of the user to which assign the roles
     * @param {RoleInstance[]} roles An array of role ids
     */
    assignRolesToUser(userId, roles) {
        this._checkIfDeleted();
        if (typeof userId !== 'string')
            throw OrganizationError.paramError('userId must be a string');
        if (!this._users[userId])
            throw OrganizationError.userDoesNotExistError(`user with id ${userId} does not exist in the organization`);
        if (!Array.isArray(roles) || roles.length <= 0 || !(roles[0] instanceof RoleInstance))
            throw OrganizationError.paramError('roles must be a non-empty array of instances of RoleInstance');
        roles.forEach(r => {
            if (!this._roles[r.id])
                throw OrganizationError.assignedRoleDoesNotExistsError(`role ${r.id} does not exist in the organization`);
            this._users[userId].set(r.id, r);
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
            throw OrganizationError.paramError('roles must be a non-empty array of ids of RoleInstance');
        roles.forEach(r => {
            if (!this._roles[r])
                throw OrganizationError.removedRoleDoesNotExistsError(`role ${r} does not exist in the organization`);
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
        const json = {
            orgId: this.orgId,
            name: this.name,
        };
        if (this.roles.length > 0)
            json.roles = this.roles;
        if (this.users.length > 0)
            json.users = this.users;
        return json;
    }
}

module.exports = Organization;
