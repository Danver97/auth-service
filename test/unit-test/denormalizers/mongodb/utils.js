const uuid = require('uuid/v4');

const defaultOrgId = '52db11c3-ffed-489e-984b-ef2972f56d8f';
const defaultRoleId = 'e64c0e2b-892a-4cbc-8b36-35304cd73ba2';
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
    };
}

function permission(scope, name, description) {
    return {
        scope: scope || 'auth-service',
        name: name || 'addRole',
        description,
    };
}

function role(roleId, orgId, permissions) {
    return {
        _id: roleId || defaultRoleId,
        roleId: roleId || defaultRoleId,
        orgId: orgId || defaultOrgId,
        permissions: permissions || [permission()],
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
    };
}

module.exports = {
    organization,
    role,
    user,
};
