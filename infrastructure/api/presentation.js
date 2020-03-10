function orgJSON(org) {
    return {
        data: org,
        links: {
            self: `/organizations/${org.orgId}`,
            roles: `/organizations/${org.orgId}/roles`,
            users: `/organizations/${org.orgId}/users`,
        }
    };
}

function roleDefJSON(roleDef, orgId) {
    return {
        data: roleDef,
        links: {
            organization: `/organizations/${roleDef.orgId || orgId}`,
            self: `/organizations/${roleDef.orgId || orgId}/roles/${roleDef.roleDefId}`,
        }
    }
}

function roleInstanceJSON(roleInstance, orgId) {
    return {
        data: roleInstance,
        links: {
            organization: `/organizations/${roleInstance.roleDef.orgId || orgId}`,
            self: `/organizations/${roleInstance.roleDef.orgId || orgId}/roles/${roleInstance.id}`,
        }
    }
}

function userJSON(user) {
    return {
        data: user,
        links: {
            self: `/users/${user.uniqueId}`,
        }
    }
}

module.exports = {
    orgJSON,
    roleDefJSON,
    roleInstanceJSON,
    userJSON,
};
