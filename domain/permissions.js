const PermissionDefinition = require('./models/permissionDef.class');

const permissionsList = [
    {
        scope: 'auth-service',
        name: 'organizationManagement',
        description: 'Allows to create or delete the entire organization',
        parameters: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                required: true,
            }
        }
    },
    {
        scope: 'auth-service',
        name: 'rolesList',
        description: 'Allows to get the list of the roles defined in the organization',
        parameters: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                required: true,
            }
        }
    },
    {
        scope: 'auth-service',
        name: 'rolesManagement',
        description: 'Allows to create, delete or modify roles in the organization',
        parameters: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                required: true,
            }
        }
    },
    {
        scope: 'auth-service',
        name: 'usersList',
        description: 'Allows to get the list of the roles defined in the organization',
        parameters: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                required: true,
            }
        }
    },
    {
        scope: 'auth-service',
        name: 'usersManagement',
        description: 'Allows to add or remove users from the organization',
        parameters: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                required: true,
            }
        }
    },
    {
        scope: 'auth-service',
        name: 'userRolesList',
        description: 'Allows to get the list of roles assigned to an user',
        parameters: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                required: true,
            }
        }
    },
    {
        scope: 'auth-service',
        name: 'userRolesManagement',
        description: 'Allows to assign or remove roles from an user',
        parameters: {
            orgId: {
                name: 'OrganizationId',
                description: 'The organization id',
                required: true,
            }
        }
    },
];

module.exports = permissionsList.map(p => PermissionDefinition.fromObject(p));
