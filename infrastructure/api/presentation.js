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

function roleJSON(role, orgId) {
    return {
        data: role,
        links: {
            organization: `/organizations/${role.orgId || orgId}`,
            self: `/organizations/${role.orgId || orgId}/roles/${role.roleId}`,
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
    roleJSON,
    userJSON,
};
