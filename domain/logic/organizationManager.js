const Organization = require('../models/organization.class');
const RepositoryError = require('../../infrastructure/repository/repo.error');
const OrganizationManagerError = require('../errors/organizationManager.error');

class OrganizationManager {
    constructor(repo) {
        this.repo = repo;
    }

    async optimisticLocking(func) {
        let result;
        const limit = 100;
        let lock = false;
        let i = 0;
        do {
            i++;
            lock = false;
            try {
                result = await func();
            } catch (e) {
                if (e instanceof RepositoryError && e.code === RepositoryError.optimisticLockingErrorCode) 
                    lock = true;
                else
                    throw e;
            }
        } while (lock && i < limit);
        return result;
    }

    organizationCreated(name) {
        return this.optimisticLocking(async () => {
            const org = new Organization(name);
            await this.repo.organizationCreated(org);
            return org;
        });
    }

    roleAdded(orgId, role) {
        return this.optimisticLocking(async () => {
            const org = await this.repo.getOrganization(orgId);
            org.addRole(role);
            await this.repo.roleAdded(org, role);
        });
    }

    roleChanged(orgId, roleId, changes) {
        return this.optimisticLocking(async () => {
            if (!changes.name && !changes.permissions)
                throw new OrganizationManagerError('No changes to apply to role');
            const org = await this.repo.getOrganization(orgId);
            const role = org.getRole(roleId);
            if (changes.name)
                role.changeName(changes.name);
            if (changes.permissions)
                role.changePermissions(changes.permissions);
            await this.repo.roleChanged(org, role);
        });
    }

    roleRemoved(orgId, roleId) {
        return this.optimisticLocking(async () => {
            const org = await this.repo.getOrganization(orgId);
            org.removeRole(roleId);
            await this.repo.roleRemoved(org, roleId);
        });
    }

    userAdded(orgId, userId) {
        return this.optimisticLocking(async () => {
            const org = await this.repo.getOrganization(orgId);
            org.addUser(userId);
            await this.repo.userAdded(org, userId);
        });
    }

    rolesAssignedToUser(orgId, userId, roles) {
        return this.optimisticLocking(async () => {
            const org = await this.repo.getOrganization(orgId);
            org.assignRolesToUser(userId, roles);
            await this.repo.rolesAssignedToUser(org, userId, roles);
        });
    }

    rolesRemovedFromUser(orgId, userId, roles) {
        return this.optimisticLocking(async () => {
            const org = await this.repo.getOrganization(orgId);
            org.removeRolesFromUser(userId, roles);
            await this.repo.rolesRemovedFromUser(org, userId, roles);
        });
    }

    userRemoved(orgId, userId) {
        return this.optimisticLocking(async () => {
            const org = await this.repo.getOrganization(orgId);
            org.removeUser(userId);
            await this.repo.userRemoved(org, userId);
        });
    }

    organizationDeleted(orgId) {
        return this.optimisticLocking(async () => {
            const org = await this.repo.getOrganization(orgId);
            org.delete();
            await this.repo.organizationDeleted(org);
        });
    }
}

module.exports = OrganizationManager;
