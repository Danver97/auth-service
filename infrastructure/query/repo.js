const QueryError = require('./query.error');
const RoleDefinition = require('../../domain/models/roleDef.class');
const RoleInstance = require('../../domain/models/roleInstance.class');

function getAllOrgRolesAggPipeline(orgId) {
    return [
        { $match: { orgId } },
        {
            $group: {
                _id: '$orgId',
                orgs: {
                    $push: {
                        $cond: [
                            {
                                $eq: [
                                    '$type', 'organization'
                                ]
                            }, '$$ROOT', null
                        ]
                    }
                },
                roles: {
                    $push: {
                        $cond: [
                            {
                                $eq: [
                                    '$type', 'role'
                                ]
                            }, '$$ROOT', null
                        ]
                    }
                }
            }
        }, {
            $project: {
                orgs: {
                    $filter: {
                        input: '$orgs',
                        as: 'item',
                        cond: {
                            $ne: [
                                '$$item', null
                            ]
                        }
                    }
                },
                roles: {
                    $filter: {
                        input: '$roles',
                        as: 'item',
                        cond: {
                            $ne: [
                                '$$item', null
                            ]
                        }
                    }
                }
            }
        }, 
        { $unwind: { path: '$orgs' } },
        {
            $replaceRoot: {
                newRoot: {
                    $mergeObjects: [
                        '$orgs', {
                            roles: '$roles'
                        }
                    ]
                }
            }
        }
    ]
}

function getAllUserOrgsAndRolesPipeline(userId) {
    return [
        {
            $match: { uniqueId: userId }
        }, {
            $lookup: {
                from: 'auth-service',
                localField: 'organizations',
                foreignField: 'orgId',
                as: 'organizations'
            }
        }, {
            $addFields: {
                organizations: {
                    $filter: {
                        input: '$organizations',
                        as: 'item',
                        cond: {
                            $eq: [
                                '$$item.type', 'organization'
                            ]
                        }
                    }
                }
            }
        }, {
            $addFields: { roles: { $objectToArray: '$roles' } }
        }, {
            $lookup: {
                from: 'auth-service',
                localField: 'roles.v',
                foreignField: 'roleId',
                as: 'roles'
            }
        }
    ]
}

class QueryManager {
    constructor(mongoCollection) {
        this.mongoCollection = mongoCollection;
    }

    async getUser(userId) {
        // Also role info and organization info can be required
        const user = await this.mongoCollection.findOne({ _id: userId, _type: 'user' });
        if (!user)
            throw QueryError.userNotFoundError(`user with ${userId} not found`);
        return user;
    }

    async getRoleDefinition(orgId, roleId) {
        const role = await this.mongoCollection.findOne({ _id: roleId, orgId, _type: 'roleDef' });
        if (!role)
            throw QueryError.roleNotFoundError(`role with ${roleId} belonging to organization with id ${orgId} not found`);
        return role;
    }

    async getOrganization(orgId) {
        // Also infos on its roles and users can be required
        const org = await this.mongoCollection.findOne({ _id: orgId, _type: 'organization' });
        if (!org)
            throw QueryError.organizationNotFoundError(`organization with ${orgId} not found`);
        return org;
    }

    async getOrganizationRoles(orgId) {
        const org = await this.getOrganization(orgId);
        if (!org)
            throw QueryError.organizationNotFoundError(`organization with ${orgId} not found`);
        return await this.mongoCollection.find({ orgId, _type: 'roleDef' }).toArray();
    }

    async getOrganizationUsers(orgId, offset = 0, limit = 200) {
        const org = await this.getOrganization(orgId);
        if (!org)
            throw QueryError.organizationNotFoundError(`organization with ${orgId} not found`);
        const users = await this.mongoCollection.find({ organizations: orgId, _type: 'user' }).skip(offset).limit(limit).toArray();
        users.forEach(u => {
            u.roles = { [orgId]: u.roles[orgId] };
        });
        return users;
    }

    async getOrganizationUserRoles(orgId, userId, options = {}) {
        const user = await this.mongoCollection.findOne({ uniqueId: userId, organizations: orgId, _type: 'user' });
        if (!user)
            throw QueryError.userNotFoundError(`user with ${userId} belonging to organization with id ${orgId} not found`);
        if (!user.roles || !user.roles[orgId])
            throw QueryError.userNotBelongingToOrganizationError(`user with ${userId} not belonging to organization with id ${orgId}`);
        const roleIds = user.roles[orgId].map(r => r.roleDefId);
        if (options.idOnly)
            return roleIds;

        const roleDefs = await this._getRoleDefinitions(roleIds);
        return this._getUserRoleInstances(user, roleDefs, orgId);
    }

    getFullOrganization(orgId) {
        return this.getFullOrganization_2calls(orgId);
    }

    getFullUser(userId) {
        return this.getFullUser_2calls(userId);
    }

    getFullOrganization_aggrPipeline(orgId) {
        return this.mongoCollection.aggregate(getAllOrgRolesAggPipeline(orgId));
    }

    getFullUser_aggrPipeline(userId) {
        return this.mongoCollection.aggregate(getAllUserOrgsAndRolesPipeline(userId));
    }

    async getFullOrganization_2calls(orgId) {
        const org = await this.getOrganization(orgId);
        const roles = await this.mongoCollection.find({ orgId, _type: 'roleDef' }).toArray();
        const users = await this.mongoCollection.find({ organizations: orgId, _type: 'user'}).toArray();
        org.roles = roles;
        org.users = users;
        return org;
    }

    async getFullUser_2calls(userId) {
        const user = await this.getUser(userId);
        const orgIds = user.organizations;
        const roleDefIds = Object.values(user.roles)
            .reduce((acc, v) => acc.concat(v), [])
            .map(r => r.roleDefId);

        const orgs = await this._getOrganizations(orgIds);
        const roleDefs = await this._getRoleDefinitions(roleDefIds);

        user.organizations = orgs;
        this._getUserRoleInstances(user, roleDefs);
        return user;
    }

    _getOrganizations(orgIds) {
        return this.mongoCollection.find({ orgId: { $in: orgIds }, _type: 'organization' }).toArray();
    }

    _getRoleDefinitions(roleIds) {
        return this.mongoCollection.find({ roleDefId: { $in: roleIds }, _type: 'roleDef' }).toArray();
    }

    _getUserRoleInstances(user, roleDefs, orgId) {
        const rolesMap = {};
        roleDefs.forEach(r => {
            rolesMap[r.roleDefId] = RoleDefinition.fromObject(r);
        });

        const mapToRoleInstance = ri => new RoleInstance({ roleDef: rolesMap[ri.roleDefId], paramValues: ri.paramValues });
        
        if (orgId) {
            return user.roles[orgId].map(mapToRoleInstance);
        }

        Object.entries(user.roles).forEach(([k, v]) => {
            user.roles[k] = v.map(mapToRoleInstance);
        });

    }

    async getUserOrganizations(userId) {
        const user = await this.getUser(userId);
        const orgIds = user.organizations;

        const orgs = await this._getOrganizations(orgIds);
        return orgs;
    }

    async getUserRoles(userId) {
        const user = await this.getUser(userId);
        const roleIds = Object.values(user.roles)
            .reduce((acc, v) => acc.concat(v), [])
            .map(r => r.roleDefId);

        const roles = await this._getRoleDefinitions(roleIds);
        const rolesMap = {};
        roles.forEach(r => {
            if (!rolesMap[r.orgId])
                rolesMap[r.orgId] = [];
            rolesMap[r.orgId].push(r);
        });
        return rolesMap;
    }

}

module.exports = QueryManager;
