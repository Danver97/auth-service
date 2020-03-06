const Role = require('./models/role.class');
const permissionList = require('./permissions');

function getReadPermissions(permissionList) {
    return permissionList.filter(p => {
        return p.scope === 'auth-service'
        && (p.name === 'rolesList'
        || p.name === 'usersList'
        || p.name === 'userRolesList');
    });
}

function getStaffManagerPermissions(permissionList) {
    return permissionList.filter(p => {
        return p.scope === 'auth-service'
        && p.name !== 'organizationManagement';
    });
}

const defaultRoles = [
    new Role('OrganizationOwner', permissionList),
    new Role('StaffManager', getStaffManagerPermissions(permissionList)),
    new Role('OrganizationMember', getReadPermissions(permissionList)),
];

module.exports = defaultRoles;
