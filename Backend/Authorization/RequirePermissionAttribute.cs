using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace ClothingManager.Authorization;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = true)]
public class RequirePermissionAttribute : TypeFilterAttribute
{
    public RequirePermissionAttribute(string permission)
        : base(typeof(PermissionFilter))
    {
        Arguments = [permission];
    }
}

public class PermissionFilter : IAuthorizationFilter
{
    private readonly string _permission;
    public PermissionFilter(string permission) => _permission = permission;

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var user = context.HttpContext.User;
        if (user.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedObjectResult(new { message = "Authentication required" });
            return;
        }
        if (!user.HasClaim("perm:" + _permission, "true"))
        {
            context.Result = new ObjectResult(new { message = $"Permission denied: {_permission}" }) { StatusCode = 403 };
        }
    }
}
