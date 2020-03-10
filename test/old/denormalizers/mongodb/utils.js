const uuid = require('uuid/v4');

const defaultOrgId = '52db11c3-ffed-489e-984b-ef2972f56d8f';
const defaultRoleId = 'e64c0e2b-892a-4cbc-8b36-35304cd73ba2';
const defaultRoleDefId = 'e31be5b9-1b6c-4ab8-ae0a-8f6018abd0c7';
const defaultUserId = '14546434341331:Google';

function organization(orgId, name, roles, users) {
    return {
        _id: orgId || defaultOrgId,
        orgId: orgId || defaultOrgId,
        name: name || 'Risto',
        roles: roles || [role()],
        users: users || [{
            userId: defaultUserId,
            roles: [role().roleId],
        }],
        _type: 'organization',
    };
}

function permission(scope, name, description) {
    return {
        scope: scope || 'auth-service',
        name: name || 'addRole',
        description,
    };
}

function permissionDef(scope, name, description, parameters) {
    return {
        scope: scope || 'reservation-service',
        name: name || 'acceptReservation',
        description: description || 'Allows to accept reservations',
        parameters: parameters || {
            orgId: { name: 'OrganizationId', description: 'The id of the organization the user belongs to', required: true },
            restId: { name: 'RestaurantId', description: 'The id of the restaurant', required: false },
        }
    };
}

function role(roleId, orgId, permissions) {
    return {
        _id: roleId || defaultRoleId,
        roleId: roleId || defaultRoleId,
        orgId: orgId || defaultOrgId,
        name: 'role1',
        _type: 'role',
        permissions: permissions || [permission()],
    };
}
function roleDef(roleDefId, orgId, paramMapping, permissions) {
    const permDef1 = permissionDef();
    return {
        _id: roleDefId || defaultRoleDefId,
        roleDefId: roleDefId || defaultRoleDefId,
        orgId: orgId || defaultOrgId,
        name: 'roleDef1',
        _type: 'roleDef',
        paramMapping: paramMapping || {
            'orgId': {
                name: 'OrganizationId',
                description: 'The id of the organization the user belongs to',
                mapping: [`${permDef1.scope}:${permDef1.name}:orgId`],
            }
        },
        permissions: permissions || [permDef1],
    };
}

function roleInstance(roleDef, paramValues) {
    return {
        roleDef,
        paramValues,
        toJSON: function () {
            return {
                roleDefId: this.roleDef.roleDefId,
                orgId: this.roleDef.orgId,
                paramValues: this.paramValues,
            }
        }
    };
}

function user(userId) {
    const uniqueId = userId || defaultUserId;
    const splits = uniqueId.split(':');
    const accountId = parseInt(splits[0]);
    const accountType = splits[1];
    return {
        _id: userId || defaultUserId,
        uniqueId,
        accountId,
        accountType,
        firstname: 'Christian',
        firstname: 'Paesante',
        email: 'chri.pae@gmail.com',
        _type: 'user',
    };
}

module.exports = {
    organization,
    // role,
    // permission,
    permissionDef,
    roleDef,
    roleInstance,
    user,
};
