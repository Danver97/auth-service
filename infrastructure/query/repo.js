const QueryError = require('./query.error');

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
        const user = await this.mongoCollection.findOne({ _id: userId, type: 'user' });
        if (!user)
            throw QueryError.notFound(`user with ${userId} not found`);
        return user;
    }

    async getRole(roleId) {
        const role = await this.mongoCollection.findOne({ _id: roleId, type: 'role' });
        if (!role)
            throw QueryError.notFound(`role with ${roleId} not found`);
        return role;
    }

    async getOrganization(orgId) {
        // Also infos on its roles and users can be required
        const org = await this.mongoCollection.findOne({ _id: orgId, type: 'organization' });
        if (!org)
            throw QueryError.notFound(`org with ${orgId} not found`);
        return org;
    }

    getOrganizationRoles(orgId) {
        return this.mongoCollection.find({ orgId, type: 'role' }).toArray();
    }

    getOrganizationUsers(orgId) {
        return this.mongoCollection.find({ organizations: orgId, type: 'user' }).toArray();
    }

    async getOrganizationUserRoles(orgId, userId, options = {}) {
        const user = await this.mongoCollection.findOne({ uniqueId: userId, organizations: orgId, type: 'user' });
        const roleIds = user.roles[orgId];
        if (options.idOnly)
            return roleIds;
        const roles = await this.mongoCollection.find({ roleId: { $in: roleIds }}).toArray();
        return roles;
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
        const roles = await this.mongoCollection.find({ orgId, type: 'role' }).toArray();
        const users = await this.mongoCollection.find({ organizations: orgId, type: 'user'}).toArray();
        org.roles = roles;
        org.users = users;
        return org;
    }

    async getFullUser_2calls(userId) {
        const user = await this.getUser(userId);
        const orgIds = user.organizations;
        const roleIds = Object.values(user.roles).reduce((acc, v) => acc.concat(v), []);

        const orgs = await this._getOrganizations(orgIds);
        const roles = await this._getRoles(roleIds);

        const rolesMap = {};
        roles.forEach(r => {
            if (!rolesMap[r.orgId])
                rolesMap[r.orgId] = [];
            rolesMap[r.orgId].push(r);
        });

        user.organizations = orgs;
        user.roles = rolesMap;
        return user;
    }

    _getOrganizations(orgIds) {
        return this.mongoCollection.find({ orgId: { $in: orgIds }, type: 'organization' }).toArray();
    }

    _getRoles(roleIds) {
        return this.mongoCollection.find({ roleId: { $in: roleIds }}).toArray();
    }

    async getUserOrganizations(userId) {
        const user = await this.getUser(userId);
        const orgIds = user.organizations;

        const orgs = await this._getOrganizations(orgIds);
        return orgs;
    }

    async getUserRoles(userId) {
        const user = await this.getUser(userId);
        const roleIds = Object.values(user.roles).reduce((acc, v) => acc.concat(v), []);

        const roles = await this._getRoles(roleIds);
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
