const Role = require('./models/role.class');
const RoleDefinition = require('./models/roleDef.class');
const permissionList = require('./permissions');

function getReadPermissions(permissionDefs) {
    return permissionDefs.toArray().filter(p => {
        return p.scope === 'auth-service'
        && (p.name === 'rolesList'
        || p.name === 'usersList'
        || p.name === 'userRolesList');
    });
}

function getStaffManagerPermissions(permissionDefs) {
    return permissionDefs.toArray().filter(p => {
        return p.scope === 'auth-service'
        && p.name !== 'organizationManagement';
    });
}

function getOrgIdMappingList(permissionDefs) {
    if (!Array.isArray(permissionDefs))
        permissionDefs = permissionDefs.toArray();
    return permissionDefs.map(p => `${p.scope}:${p.name}:orgId`);
}

const defaultRoles = {
    OrganizationOwner: new RoleDefinition({
        roleDefId: 'OrganizationOwner',
        name: 'OrganizationOwner',
        description: 'Owner of the organization, has full permissions',
        permissions: permissionList.toArray(),
        paramMapping: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                mapping: getOrgIdMappingList(permissionList),
            }
        }
    }),
    StaffManager: new RoleDefinition({
        roleDefId: 'StaffManager',
        name: 'StaffManager',
        description: 'Manage the staff of organization. Manage users and their roles.',
        permissions: getStaffManagerPermissions(permissionList),
        paramMapping: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                mapping: getOrgIdMappingList(getStaffManagerPermissions(permissionList)),
            }
        }
    }),
    OrganizationMember: new RoleDefinition({
        roleDefId: 'OrganizationMember',
        name: 'OrganizationMember',
        description: 'Member of the organization. Can see the resource of the organization, but can\' modify anything.',
        permissions: getReadPermissions(permissionList),
        paramMapping: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                mapping: getOrgIdMappingList(getReadPermissions(permissionList)),
            }
        }
    }),
    toArray() {
        return Object.values(this).filter(v => typeof v !== 'undefined' && typeof v !== 'function');
    }
};

module.exports = defaultRoles;
