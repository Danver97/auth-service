const dbs = require('@danver97/event-sourcing/eventStore');
const Role = require('../../domain/models/role.class');
const Organization = require('../../domain/models/organization.class');
const orgEvents = require('../../lib/organization-events');
const ENV = require('../../lib/env');

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

    roleAdded(org, role){
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.roleAdded, { orgId: org.orgId, role });
    }

    roleRemoved(org, roleId){
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.roleRemoved, { orgId: org.orgId, roleId });
    }

    userAdded(org, userId){
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.userAdded, { orgId: org.orgId, userId });
    }

    rolesAssignedToUser(org, userId, roles) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.rolesAssignedToUser, { orgId: org.orgId, userId, roles });
    }

    rolesRemovedFromUser(org, userId, roles) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.rolesRemovedFromUser, { orgId: org.orgId, userId, roles });
    }

    userRemoved(org, userId){
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.userRemoved, { orgId: org.orgId, userId });
    }

    organizationDeleted(org) {
        return this.saveEvent(org.orgId, org._revisionId, orgEvents.organizationDeleted, { orgId: org.orgId, status: org.status });
    }

    async getOrganization(orgId) {
        const events = await this.db.getStream(orgId);
        let org;
        events.forEach(e => {
            switch (e.message) {
                case orgEvents.organizationCreated:
                    org = Organization.fromObject(e.payload);
                    break;
                case orgEvents.roleAdded:
                    org.addRole(Role.fromObject(e.payload.role));
                    break;
                case orgEvents.roleRemoved:
                    org.removeRole(e.payload.roleId);
                    break;
                case orgEvents.userAdded:
                    org.addUser(e.payload.userId);
                    break;
                case orgEvents.rolesAssignedToUser:
                    org.assignRolesToUser(e.payload.userId, e.payload.roles);
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
}


function exportFunc(db) {
    let repo;
    if (!db)
        repo = new RepositoryManager(dbs[ENV.event_store]);
    else
        repo = new RepositoryManager(dbs[db]);
    console.log(`Repo started with: ${db || ENV.event_store}`);
    return repo;
}

module.exports = exportFunc;
