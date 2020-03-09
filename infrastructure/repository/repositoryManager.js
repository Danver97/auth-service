const dbs = require('@danver97/event-sourcing/eventStore');
const PermissionDefinition = require('../../domain/models/permissionDef.class');
const RoleDefinition = require('../../domain/models/roleDef.class');
const RoleInstance = require('../../domain/models/roleInstance.class');
const Organization = require('../../domain/models/organization.class');
const User = require('../../domain/models/user.class');
const orgEvents = require('../../lib/organization-events');
const userEvents = require('../../lib/user-events');
const ENV = require('../../lib/env');
const RepositoryError = require('./repo.error');

class RepositoryManager {
    constructor(db) {
        this.db = db;
    }

    async saveEvent(streamId, eventId, message, payload) {
        return this.db.save(streamId, eventId, message, payload);
        // for optmistic locking
        /* try {
            await this.db.save(streamId, eventId, message, payload);
        } catch (e) {
            if (e.code === 'cazzo ne so')
                throw new RepositoryError('RepositoryError: Aggregate not up to date', 401);
        } */
    }

    organizationCreated(org) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.organizationCreated, org.toJSON());
    }

    roleDefinitionAdded(org, roleDef) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.roleDefinitionAdded, { orgId: org.orgId, roleDef });
    }

    roleDefinitionChanged(org, roleDef) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.roleDefinitionChanged, { orgId: org.orgId, roleDef });
    }

    roleDefinitionRemoved(org, roleId) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.roleDefinitionRemoved, { orgId: org.orgId, roleId });
    }

    userAdded(org, userId) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.userAdded, { orgId: org.orgId, userId });
    }

    /**
     * 
     * @param {Organization} org 
     * @param {string} userId 
     * @param {RoleInstance[]} roles 
     */
    rolesAssignedToUser(org, userId, roles) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.rolesAssignedToUser, { orgId: org.orgId, userId, roles });
    }

    /**
     * 
     * @param {Organization} org 
     * @param {string} userId 
     * @param {string[]} roles 
     */
    rolesRemovedFromUser(org, userId, roles) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.rolesRemovedFromUser, { orgId: org.orgId, userId, roles });
    }

    userRemoved(org, userId) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.userRemoved, { orgId: org.orgId, userId });
    }

    organizationDeleted(org) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.organizationDeleted, { orgId: org.orgId, status: org.status });
    }

    async getOrganization(orgId) {
        const events = await this.db.getStream(orgId);
        if (!events || events.length === 0)
            throw RepositoryError.organizationStreamNotFoundError(`Organization with id ${orgId} not found`);
        let org;
        events.forEach(e => {
            switch (e.message) {
                case orgEvents.organizationCreated:
                    org = Organization.fromObject(e.payload);
                    break;
                case orgEvents.roleDefinitionAdded:
                    org.addRoleDefinition(RoleDefinition.fromObject(e.payload.roleDef));
                    break;
                case orgEvents.roleDefinitionChanged:
                    const rolePayload = e.payload.roleDef;
                    const roleDef = org.getRoleDefinition(rolePayload.roleDefId);
                    roleDef.changeName(rolePayload.name);
                    const permissions = rolePayload.permissions.map(p => PermissionDefinition.fromObject(p));
                    roleDef.changeParamsMapping(rolePayload.paramMapping);
                    roleDef.changePermissions(permissions);
                    break;
                case orgEvents.roleDefinitionRemoved:
                    org.removeRoleDefinition(e.payload.roleId);
                    break;
                case orgEvents.userAdded:
                    org.addUser(e.payload.userId);
                    break;
                case orgEvents.rolesAssignedToUser:
                    const roles = e.payload.roles.map(r => new RoleInstance({ roleDef:org.getRoleDefinition(r.roleDefId), paramValues: r.paramValues }));
                    org.assignRolesToUser(e.payload.userId, roles);
                    break;
                case orgEvents.rolesRemovedFromUser:
                    org.removeRolesFromUser(e.payload.userId, e.payload.roles);
                    break;
                case orgEvents.userRemoved:
                    org.removeUser(e.payload.userId);
                    break;
                case orgEvents.organizationDeleted:
                    org.delete();
                    break;
            }
        });
        org._revisionId = events.length;
        return org;
    }

    userCreated(user) {
        return this.saveEvent(user.uniqueId, user._revisionId, userEvents.userCreated, user.toJSON());
    }

    async getUser(userId) {
        const events = await this.db.getStream(userId);
        if (!events || events.length === 0)
            throw RepositoryError.userStreamNotFoundError(`User with id ${userId} not found`);
        let user;
        events.forEach(e => {
            switch (e.message) {
                case userEvents.userCreated:
                    user = User.fromObject(e.payload);
                    break;
            }
        });
        user._revisionId = events.length;
        return user;
    }
}


function exportFunc(db) {
    let repo;
    if (!db)
        repo = new RepositoryManager(dbs[ENV.EVENT_STORE]);
    else
        repo = new RepositoryManager(dbs[db]);
    console.log(`Repo started with: ${db || ENV.EVENT_STORE}`);
    return repo;
}

module.exports = exportFunc;
