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

    getUser(userId) {
        // Also role info and organization info can be required
        return this.mongoCollection.findOne({ _id: userId, type: "user" });
    }

    getRole(roleId) {
        return this.mongoCollection.findOne({ _id: roleId, type: "role" });
    }

    getOrganization(orgId) {
        // Also infos on its roles and users can be required
        return this.mongoCollection.findOne({ _id: orgId, type: "organization" });
    }

    getOrganizationUsers(orgId) {
        return this.mongoCollection.find({ organizations: orgId, type: "user" }).toArray();
    }

    getOrganizationRoles(orgId) {
        return this.mongoCollection.find({ orgId, type: "role" }).toArray();
    }

    getFullOrganization(orgId) {
        return this.mongoCollection.aggregate(getAllOrgRolesAggPipeline(orgId));
    }

    getFullUser(userId) {
        return this.mongoCollection.aggregate(getAllUserOrgsAndRolesPipeline(userId));
    }

    async getFullOrganization2(orgId) {
        const org = await this.getOrganization(orgId);
        const roles = await this.mongoCollection.find({ orgId, type: 'role' }).toArray();
        const users = await this.mongoCollection.find({ organizations: orgId, type: 'user'}).toArray();
        org.roles = roles;
        org.users = users;
        return org;
    }

    async getFullUser2(userId) {
        const user = await this.getUser(userId);
        const orgIds = user.organizations;
        const roleIds = Object.values(user.roles).reduce((acc, v) => acc.concat(v), []);

        const orgs = await this.mongoCollection.find({ orgId: { $in: orgIds }, type: 'organization' }).toArray();
        const roles = await this.mongoCollection.find({ roleId: { $in: roleIds }}).toArray();

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
}

module.exports = QueryManager;
